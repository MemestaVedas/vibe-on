mod audio;
mod cover_fetcher;
mod database;
mod discord_rpc;

use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

use audio::state::PlayerStatus;
use audio::{AudioPlayer, TrackInfo};
use database::DatabaseManager;
use discord_rpc::DiscordRpc;

// Discord App ID
const DISCORD_APP_ID: &str = "1463457295974535241";

/// Global player state managed by Tauri
pub struct AppState {
    player: Mutex<Option<AudioPlayer>>,
    db: Mutex<Option<DatabaseManager>>,
    discord: Arc<DiscordRpc>,
    current_cover_url: Arc<Mutex<Option<String>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            player: Mutex::new(None),
            db: Mutex::new(None),
            discord: Arc::new(DiscordRpc::new(DISCORD_APP_ID)),
            current_cover_url: Arc::new(Mutex::new(None)),
        }
    }
}

/// Initialize the audio player
fn get_or_init_player(state: &AppState) -> Result<(), String> {
    let mut player_guard = state.player.lock().unwrap();
    if player_guard.is_none() {
        *player_guard = Some(AudioPlayer::new()?);
    }
    Ok(())
}

fn get_or_init_db(state: &AppState, app_handle: &AppHandle) -> Result<(), String> {
    let mut db_guard = state.db.lock().unwrap();
    if db_guard.is_none() {
        *db_guard = Some(DatabaseManager::new(app_handle).map_err(|e| e.to_string())?);
    }
    Ok(())
}

// ============================================================================
// Tauri Commands - Playback Control
// ============================================================================

#[tauri::command]
fn play_file(path: String, state: State<AppState>) -> Result<(), String> {
    get_or_init_player(&state)?;

    // Convert path string to Path
    let path_obj = Path::new(&path);

    // Try to get metadata for Discord
    let _ = state.discord.connect();

    // Reset current cover
    if let Ok(mut url_guard) = state.current_cover_url.lock() {
        *url_guard = None;
    }

    if let Ok((info, _)) = get_track_metadata_helper(&path) {
        // Set initial activity
        let _ = state.discord.set_activity(
            &info.title,
            &info.artist,
            Some(info.duration_secs),
            None,
            Some(info.album.clone()),
        );

        let discord_clone = state.discord.clone();
        let url_mutex_clone = state.current_cover_url.clone();
        let artist = info.artist.clone();
        let album = info.album.clone();
        let title = info.title.clone();
        let duration = info.duration_secs;

        std::thread::spawn(move || {
            println!("[Cover] Searching for: {} - {}", artist, album);
            if let Some(url) = cover_fetcher::search_cover(&artist, &album) {
                println!("[Cover] Found URL: {}", url);
                // Save to state
                if let Ok(mut guard) = url_mutex_clone.lock() {
                    *guard = Some(url.clone());
                }

                // Update Discord
                let _ = discord_clone.set_activity(
                    &title,
                    &artist,
                    Some(duration),
                    Some(url),
                    Some(album),
                );
            } else {
                println!("[Cover] No cover found for: {} - {}", artist, album);
            }
        });
    } else {
        let filename = path_obj
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown Track");
        let _ = state
            .discord
            .set_activity(filename, "Listening", None, None, None);
    }

    let player_guard = state.player.lock().unwrap();
    if let Some(ref player) = *player_guard {
        player.play_file(&path)
    } else {
        Err("Player not initialized".to_string())
    }
}

#[tauri::command]
fn pause(state: State<AppState>) -> Result<(), String> {
    let player_guard = state.player.lock().unwrap();
    if let Some(ref player) = *player_guard {
        let status = player.get_status();
        let cover_url = state.current_cover_url.lock().unwrap().clone();

        if let Some(track) = status.track {
            let _ = state.discord.set_activity(
                &format!("(Paused) {}", track.title),
                &track.artist,
                None, // No duration for pause
                cover_url,
                Some(track.album),
            );
        } else {
            let _ = state
                .discord
                .set_activity("Paused", "Vibe Music Player", None, None, None);
        }
        player.pause()
    } else {
        Ok(())
    }
}

#[tauri::command]
fn resume(state: State<AppState>) -> Result<(), String> {
    let player_guard = state.player.lock().unwrap();
    if let Some(ref player) = *player_guard {
        let status = player.get_status();
        let cover_url = state.current_cover_url.lock().unwrap().clone();

        if let Some(track) = status.track {
            let _ = state.discord.set_activity(
                &track.title,
                &track.artist,
                Some(track.duration_secs),
                cover_url,
                Some(track.album),
            );
        }
        player.resume()
    } else {
        Ok(())
    }
}

#[tauri::command]
fn stop(state: State<AppState>) -> Result<(), String> {
    let player_guard = state.player.lock().unwrap();
    if let Some(ref player) = *player_guard {
        let _ = state.discord.clear_activity();
        if let Ok(mut url_guard) = state.current_cover_url.lock() {
            *url_guard = None;
        }
        player.stop()
    } else {
        Ok(())
    }
}

#[tauri::command]
fn set_volume(value: f32, state: State<AppState>) -> Result<(), String> {
    let player_guard = state.player.lock().unwrap();
    if let Some(ref player) = *player_guard {
        player.set_volume(value)
    } else {
        Ok(())
    }
}

#[tauri::command]
fn get_player_state(state: State<AppState>) -> PlayerStatus {
    let player_guard = state.player.lock().unwrap();
    if let Some(ref player) = *player_guard {
        player.get_status()
    } else {
        PlayerStatus::default()
    }
}

// ============================================================================
// Tauri Commands - Library Management
// ============================================================================

#[tauri::command]
async fn init_library(
    path: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<Vec<TrackInfo>, String> {
    // 1. Init DB if needed
    get_or_init_db(&state, &app_handle)?;

    // 2. Scan folder (simple implementation for now calling the helper)
    // Note: In a real app this should probably be in a separate thread/task outside the async runtime block if blocking
    // But scan_music_folder_helper is sync.
    let path_obj = Path::new(&path);
    if !path_obj.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let files = scan_music_folder_helper(path_obj);
    let mut tracks = Vec::new();

    // 3. Process metadata and insert into DB
    let db_guard = state.db.lock().unwrap();
    if let Some(ref db) = *db_guard {
        for file_path in files {
            // Re-use logic from get_track_metadata but we need it available here
            if let Ok((track, cover_data)) = get_track_metadata_helper(&file_path) {
                if let Err(e) = db.insert_track(&track, cover_data.as_deref()) {
                    eprintln!("Failed to insert track {}: {}", file_path, e);
                }
                tracks.push(track);
            }
        }

        // Return all tracks currently in DB (or just the new ones? Use get_all_tracks for consistency)
        db.get_all_tracks().map_err(|e| e.to_string())
    } else {
        Err("Database not initialized".to_string())
    }
}

#[tauri::command]
fn get_library_tracks(
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<Vec<TrackInfo>, String> {
    get_or_init_db(&state, &app_handle)?;
    let db_guard = state.db.lock().unwrap();
    if let Some(ref db) = *db_guard {
        db.get_all_tracks().map_err(|e| e.to_string())
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
fn get_covers_dir(state: State<AppState>, app_handle: AppHandle) -> Result<String, String> {
    get_or_init_db(&state, &app_handle)?;
    let db_guard = state.db.lock().unwrap();
    if let Some(ref db) = *db_guard {
        Ok(db.get_covers_dir().to_string_lossy().to_string())
    } else {
        Err("Database not initialized".to_string())
    }
}

// Helper functions (extracted from previous commands)
fn scan_music_folder_helper(path: &Path) -> Vec<String> {
    let audio_extensions = ["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus"];
    let mut files = Vec::new();

    fn scan_recursive(dir: &Path, extensions: &[&str], files: &mut Vec<String>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    scan_recursive(&path, extensions, files);
                } else if let Some(ext) = path.extension() {
                    if let Some(ext_str) = ext.to_str() {
                        if extensions.contains(&ext_str.to_lowercase().as_str()) {
                            if let Some(path_str) = path.to_str() {
                                files.push(path_str.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    scan_recursive(path, &audio_extensions, &mut files);
    files.sort();
    files
}

// Helper to find external cover image in the directory
fn find_external_cover(dir: &Path) -> Option<std::path::PathBuf> {
    let filenames = [
        "cover.jpg",
        "cover.png",
        "folder.jpg",
        "folder.png",
        "album.jpg",
        "album.png",
    ];
    for name in filenames.iter() {
        let p = dir.join(name);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

fn get_track_metadata_helper(path_str: &str) -> Result<(TrackInfo, Option<Vec<u8>>), String> {
    use lofty::prelude::*;
    use lofty::probe::Probe;

    let path = Path::new(path_str);
    let tagged_file_res = Probe::open(path)
        .map_err(|e| format!("Failed to probe file: {}", e))?
        .read();

    // Handle cases where reading tags fails but we still want the file
    // For now we error out if read fails, as before.
    let tagged_file = tagged_file_res.map_err(|e| format!("Failed to read metadata: {}", e))?;

    let properties = tagged_file.properties();
    let duration_secs = properties.duration().as_secs_f64();

    let (title, artist, album) = if let Some(tag) = tagged_file.primary_tag() {
        (
            tag.title().map(|s| s.to_string()).unwrap_or_else(|| {
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unknown")
                    .to_string()
            }),
            tag.artist()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Artist".to_string()),
            tag.album()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Album".to_string()),
        )
    } else {
        (
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string(),
            "Unknown Artist".to_string(),
            "Unknown Album".to_string(),
        )
    };

    // Extract picture
    let mut cover_data = tagged_file
        .primary_tag()
        .and_then(|tag| tag.pictures().first())
        .map(|pic| pic.data().to_vec());

    // Fallback to external cover if no embedded art
    if cover_data.is_none() {
        if let Some(parent) = path.parent() {
            if let Some(cover_path) = find_external_cover(parent) {
                if let Ok(data) = std::fs::read(cover_path) {
                    cover_data = Some(data);
                }
            }
        }
    }

    Ok((
        TrackInfo {
            path: path.to_string_lossy().to_string(),
            title,
            artist,
            album,
            duration_secs,
            cover_image: None, // Will be populated from DB later
        },
        cover_data,
    ))
}

// Keep the old commands for now but scan_music_folder is now internal helper mostly
#[tauri::command]
fn scan_music_folder(path: String) -> Result<Vec<String>, String> {
    Ok(scan_music_folder_helper(Path::new(&path)))
}

#[tauri::command]
fn get_track_metadata(path: String) -> Result<TrackInfo, String> {
    get_track_metadata_helper(&path).map(|(info, _)| info)
}

// ============================================================================
// App Entry Point
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            play_file,
            pause,
            resume,
            stop,
            set_volume,
            get_player_state,
            scan_music_folder,
            get_track_metadata,
            init_library,
            get_library_tracks,
            get_covers_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
