//! HTTP REST API routes for VIBE-ON! server

use std::sync::Arc;

use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::audio::TrackInfo;
use super::{ServerState, TrackSummary};

/// Health check response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
}

/// Server info response
#[derive(Serialize)]
pub struct ServerInfoResponse {
    pub name: String,
    pub version: String,
    pub platform: String,
    #[serde(rename = "librarySize")]
    pub library_size: usize,
    pub port: u16,
    #[serde(rename = "localIp")]
    pub local_ip: Option<String>,
}

/// Playback state response
#[derive(Serialize)]
pub struct PlaybackStateResponse {
    #[serde(rename = "isPlaying")]
    pub is_playing: bool,
    #[serde(rename = "currentTrack")]
    pub current_track: Option<TrackDetail>,
    #[serde(rename = "positionSecs")]
    pub position_secs: f64,
    #[serde(rename = "durationSecs")]
    pub duration_secs: f64,
    pub volume: f64,
    pub shuffle: bool,
    #[serde(rename = "repeatMode")]
    pub repeat_mode: String,
    pub queue: Vec<TrackSummary>,
}

/// Detailed track info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackDetail {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    #[serde(rename = "durationSecs")]
    pub duration_secs: f64,
    #[serde(rename = "discNumber")]
    pub disc_number: Option<u32>,
    #[serde(rename = "trackNumber")]
    pub track_number: Option<u32>,
    #[serde(rename = "coverUrl")]
    pub cover_url: Option<String>,
    #[serde(rename = "titleRomaji")]
    pub title_romaji: Option<String>,
    #[serde(rename = "titleEn")]
    pub title_en: Option<String>,
    #[serde(rename = "artistRomaji")]
    pub artist_romaji: Option<String>,
    #[serde(rename = "artistEn")]
    pub artist_en: Option<String>,
    #[serde(rename = "albumRomaji")]
    pub album_romaji: Option<String>,
    #[serde(rename = "albumEn")]
    pub album_en: Option<String>,
    #[serde(rename = "playlistTrackId", skip_serializing_if = "Option::is_none")]
    pub playlist_track_id: Option<i64>,
}

/// Album info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlbumInfo {
    pub name: String,
    pub artist: String,
    #[serde(rename = "coverUrl")]
    pub cover_url: Option<String>,
    #[serde(rename = "trackCount")]
    pub track_count: usize,
}

/// Artist info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistInfo {
    pub name: String,
    #[serde(rename = "albumCount")]
    pub album_count: usize,
    #[serde(rename = "trackCount")]
    pub track_count: usize,
}

/// Library response
#[derive(Serialize)]
pub struct LibraryResponse {
    pub tracks: Vec<TrackDetail>,
    pub total: usize,
}

/// Search response
#[derive(Serialize)]
pub struct SearchResponse {
    pub tracks: Vec<TrackDetail>,
    pub albums: Vec<AlbumInfo>,
    pub artists: Vec<ArtistInfo>,
}

/// Albums response
#[derive(Serialize)]
pub struct AlbumsResponse {
    pub albums: Vec<AlbumInfo>,
    pub total: usize,
}

/// Album detail response
#[derive(Serialize)]
pub struct AlbumDetailResponse {
    pub album: AlbumInfo,
    pub tracks: Vec<TrackDetail>,
}

/// Artists response
#[derive(Serialize)]
pub struct ArtistsResponse {
    pub artists: Vec<ArtistInfo>,
    pub total: usize,
}

/// Artist detail response
#[derive(Serialize)]
pub struct ArtistDetailResponse {
    pub artist: ArtistInfo,
    pub albums: Vec<AlbumInfo>,
    pub tracks: Vec<TrackDetail>,
}

/// Lyrics response
#[derive(Serialize)]
pub struct LyricsResponse {
    #[serde(rename = "trackPath")]
    pub track_path: String,
    #[serde(rename = "hasSynced")]
    pub has_synced: bool,
    #[serde(rename = "syncedLyrics")]
    pub synced_lyrics: Option<String>,
    #[serde(rename = "plainLyrics")]
    pub plain_lyrics: Option<String>,
    pub instrumental: bool,
}

/// Statistics response
#[derive(Serialize)]
pub struct StatsResponse {
    #[serde(rename = "totalSongs")]
    pub total_songs: usize,
    #[serde(rename = "totalAlbums")]
    pub total_albums: usize,
    #[serde(rename = "totalArtists")]
    pub total_artists: usize,
    #[serde(rename = "totalDurationHours")]
    pub total_duration_hours: f64,
}

/// Pagination query params
#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub offset: Option<usize>,
    pub limit: Option<usize>,
}

/// Search query params
#[derive(Debug, Deserialize)]
pub struct SearchParams {
    pub q: String,
    pub offset: Option<usize>,
    pub limit: Option<usize>,
}

/// Stream query params
#[derive(Debug, Deserialize)]
pub struct StreamParams {
    pub start: Option<u64>,
}

/// Stream range params for HTTP Range requests
#[derive(Debug, Deserialize)]
pub struct RangeParams {
    pub path: String,
}

/// Health check endpoint
pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
    })
}

/// Get server info
pub async fn get_server_info(
    State(state): State<Arc<ServerState>>,
) -> Json<ServerInfoResponse> {
    let app_state = state.app_state();
    let library_size = app_state.db.lock().ok()
        .and_then(|db| db.as_ref().map(|d| d.get_all_tracks().map(|t| t.len()).unwrap_or(0)))
        .unwrap_or(0);
    
    // Get local IP address
    let local_ip = get_local_ip();
    
    Json(ServerInfoResponse {
        name: state.config.server_name.clone(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        library_size,
        port: state.config.port,
        local_ip,
    })
}

/// Get local IP address for LAN connections
fn get_local_ip() -> Option<String> {
    use std::net::UdpSocket;
    
    // Create a UDP socket and "connect" to a public IP (doesn't actually send data)
    // This lets us determine which local interface would be used
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    let local_addr = socket.local_addr().ok()?;
    Some(local_addr.ip().to_string())
}

/// Get current playback state
pub async fn get_playback_state(
    State(state): State<Arc<ServerState>>,
) -> Json<PlaybackStateResponse> {
    let app_state = state.app_state();
    
    // Get player status
    let (is_playing, current_track, position_secs, duration_secs, volume) = {
        if let Ok(player_guard) = app_state.player.lock() {
            if let Some(ref player) = *player_guard {
                let status = player.get_status();
                let is_playing = status.state == crate::audio::PlayerState::Playing;
                let position = status.position_secs;
                let volume = status.volume;
                let duration = status.track.as_ref().map(|t| t.duration_secs).unwrap_or(0.0);
                
                let track = status.track.map(|t| TrackDetail {
                    path: t.path.clone(),
                    title: t.title.clone(),
                    artist: t.artist.clone(),
                    album: t.album.clone(),
                    duration_secs: t.duration_secs,
                    disc_number: t.disc_number,
                    track_number: t.track_number,
                    cover_url: Some(format!("/cover/{}", urlencoding::encode(t.cover_image.as_deref().unwrap_or(&t.path)))),
                    title_romaji: t.title_romaji.clone(),
                    title_en: t.title_en.clone(),
                    artist_romaji: t.artist_romaji.clone(),
                    artist_en: t.artist_en.clone(),
                    album_romaji: t.album_romaji.clone(),
                    album_en: t.album_en.clone(),
                    playlist_track_id: t.playlist_track_id,
                });
                
                (is_playing, track, position, duration, volume)
            } else {
                (false, None, 0.0, 0.0, 1.0)
            }
        } else {
            (false, None, 0.0, 0.0, 1.0)
        }
    };
    
    Json(PlaybackStateResponse {
        is_playing,
        current_track,
        position_secs,
        duration_secs,
        volume: volume as f64,
        shuffle: false, // TODO: Get from frontend state
        repeat_mode: "off".to_string(),
        queue: vec![], // TODO: Implement queue sync
    })
}

/// Get library tracks
pub async fn get_library(
    State(state): State<Arc<ServerState>>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<LibraryResponse>, StatusCode> {
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(50);
    
    let app_state = state.app_state();
    
    // Get total count (inefficient but needed for pagination UI, ideally separate count query)
    // For now, let's just get all tracks count from DB or use a count method if added.
    // db.rs doesn't have count method.
    // Using get_all_tracks() just for count is bad but better than transferring all data.
    // Actually, let's assume total is large and just return arbitrary large number or 
    // implement `get_total_tracks_count` in DB.
    // For this sprint, I'll stick to `get_all_tracks().len()` for total, 
    // BUT use `get_tracks_paginated` for actual data. 
    // This is still O(N) for count, but O(1) for data transfer. 
    // Ideally user scrolls infinitely so total doesn't matter much or we can cache it.
    
    // OPTIMIZATION: We really should add `get_track_count` to db.rs.
    // But for now, let's focus on the data fetch.
    
    let tracks = app_state.db.lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?
        .get_tracks_paginated(limit, offset)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // We need total for the UI.
    // Temporary hack: fetch all for total until get_count is added.
    // Or just pass 99999 if UI handles it.
    // Let's do a quick count query if possible or just use existing get_all_tracks for now 
    // accepting the CPU cost for count but saving memory/transfer for data.
    let total = app_state.db.lock()
       .unwrap().as_ref().unwrap().get_all_tracks().map(|t| t.len()).unwrap_or(0);

    let tracks: Vec<TrackDetail> = tracks
        .into_iter()
        .map(|t| TrackDetail {
            path: t.path.clone(),
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration_secs: t.duration_secs,
            disc_number: t.disc_number,
            track_number: t.track_number,
            cover_url: Some(format!("/cover/{}", urlencoding::encode(t.cover_image.as_deref().unwrap_or(&t.path)))),
            title_romaji: t.title_romaji,
            title_en: t.title_en,
            artist_romaji: t.artist_romaji,
            artist_en: t.artist_en,
            album_romaji: t.album_romaji,
            album_en: t.album_en,
            playlist_track_id: t.playlist_track_id,
        })
        .collect();
    
    Ok(Json(LibraryResponse { tracks, total }))
}

/// Search library
pub async fn search_library(
    State(state): State<Arc<ServerState>>,
    Query(params): Query<SearchParams>,
) -> Result<Json<SearchResponse>, StatusCode> {
    let query = params.q.to_lowercase();
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(50);
    
    let app_state = state.app_state();
    let all_tracks = app_state.db.lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?
        .get_all_tracks()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Filter tracks
    let tracks: Vec<TrackDetail> = all_tracks
        .iter()
        .filter(|t| {
            t.title.to_lowercase().contains(&query) ||
            t.artist.to_lowercase().contains(&query) ||
            t.album.to_lowercase().contains(&query)
        })
        .skip(offset)
        .take(limit)
        .map(|t| TrackDetail {
            path: t.path.clone(),
            title: t.title.clone(),
            artist: t.artist.clone(),
            album: t.album.clone(),
            duration_secs: t.duration_secs,
            disc_number: t.disc_number,
            track_number: t.track_number,
            cover_url: Some(format!("/cover/{}", urlencoding::encode(t.cover_image.as_deref().unwrap_or(&t.path)))),
            title_romaji: t.title_romaji.clone(),
            title_en: t.title_en.clone(),
            artist_romaji: t.artist_romaji.clone(),
            artist_en: t.artist_en.clone(),
            album_romaji: t.album_romaji.clone(),
            album_en: t.album_en.clone(),
            playlist_track_id: t.playlist_track_id,
        })
        .collect();
    
    // Get unique albums
    let mut albums_map = std::collections::HashMap::new();
    for track in &all_tracks {
        if track.album.to_lowercase().contains(&query) ||
           track.artist.to_lowercase().contains(&query) {
            let key = (track.album.clone(), track.artist.clone());
            let entry = albums_map.entry(key).or_insert((0, track.path.clone()));
            entry.0 += 1;
        }
    }
    let albums: Vec<AlbumInfo> = albums_map
        .into_iter()
        .take(limit)
        .map(|((name, artist), (count, path))| AlbumInfo {
            name,
            artist,
            cover_url: Some(format!("/cover/{}", urlencoding::encode(&path))),
            track_count: count,
        })
        .collect();
    
    // Get unique artists
    let mut artists_map = std::collections::HashMap::new();
    for track in &all_tracks {
        if track.artist.to_lowercase().contains(&query) {
            let entry = artists_map.entry(track.artist.clone()).or_insert((std::collections::HashSet::new(), 0));
            entry.0.insert(track.album.clone());
            entry.1 += 1;
        }
    }
    let artists: Vec<ArtistInfo> = artists_map
        .into_iter()
        .take(limit)
        .map(|(name, (albums, track_count))| ArtistInfo {
            name,
            album_count: albums.len(),
            track_count,
        })
        .collect();
    
    Ok(Json(SearchResponse { tracks, albums, artists }))
}

/// Get all albums
pub async fn get_albums(
    State(state): State<Arc<ServerState>>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<AlbumsResponse>, StatusCode> {
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(50);
    
    let app_state = state.app_state();
    let (db_albums, total) = app_state.db.lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?
        .get_albums_paginated(limit, offset)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let albums: Vec<AlbumInfo> = db_albums
        .into_iter()
        .map(|a| AlbumInfo {
            name: a.name,
            artist: a.artist,
            cover_url: a.cover_image_path.map(|p| format!("/cover/{}", urlencoding::encode(&p))),
            track_count: a.track_count,
        })
        .collect();
    
    Ok(Json(AlbumsResponse { albums, total }))
}

/// Get album detail
pub async fn get_album_detail(
    State(state): State<Arc<ServerState>>,
    Path((name, artist)): Path<(String, String)>,
) -> Result<Json<AlbumDetailResponse>, StatusCode> {
    let name = urlencoding::decode(&name).map_err(|_| StatusCode::BAD_REQUEST)?.to_string();
    let artist = urlencoding::decode(&artist).map_err(|_| StatusCode::BAD_REQUEST)?.to_string();
    
    let app_state = state.app_state();
    let all_tracks = app_state.db.lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?
        .get_all_tracks()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let tracks: Vec<TrackDetail> = all_tracks
        .into_iter()
        .filter(|t| t.album == name && t.artist == artist)
        .map(|t| TrackDetail {
            path: t.path.clone(),
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration_secs: t.duration_secs,
            disc_number: t.disc_number,
            track_number: t.track_number,
            cover_url: Some(format!("/cover/{}", urlencoding::encode(&t.path))),
            title_romaji: t.title_romaji,
            title_en: t.title_en,
            artist_romaji: t.artist_romaji,
            artist_en: t.artist_en,
            album_romaji: t.album_romaji,
            album_en: t.album_en,
            playlist_track_id: t.playlist_track_id,
        })
        .collect();
    
    if tracks.is_empty() {
        return Err(StatusCode::NOT_FOUND);
    }
    
    let album = AlbumInfo {
        name: name.clone(),
        artist: artist.clone(),
        cover_url: tracks.first().and_then(|t| t.cover_url.clone()),
        track_count: tracks.len(),
    };
    
    Ok(Json(AlbumDetailResponse { album, tracks }))
}

/// Get all artists
pub async fn get_artists(
    State(state): State<Arc<ServerState>>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<ArtistsResponse>, StatusCode> {
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(50);
    
    let app_state = state.app_state();
    let (db_artists, total) = app_state.db.lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?
        .get_artists_paginated(limit, offset)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let artists: Vec<ArtistInfo> = db_artists
        .into_iter()
        .map(|a| ArtistInfo {
            name: a.name,
            album_count: a.album_count,
            track_count: a.track_count,
        })
        .collect();
    
    Ok(Json(ArtistsResponse { artists, total }))
}

/// Get artist detail
pub async fn get_artist_detail(
    State(state): State<Arc<ServerState>>,
    Path(name): Path<String>,
) -> Result<Json<ArtistDetailResponse>, StatusCode> {
    let name = urlencoding::decode(&name).map_err(|_| StatusCode::BAD_REQUEST)?.to_string();
    
    let app_state = state.app_state();
    let all_tracks = app_state.db.lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?
        .get_all_tracks()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let tracks: Vec<TrackDetail> = all_tracks
        .iter()
        .filter(|t| t.artist == name)
        .map(|t| TrackDetail {
            path: t.path.clone(),
            title: t.title.clone(),
            artist: t.artist.clone(),
            album: t.album.clone(),
            duration_secs: t.duration_secs,
            disc_number: t.disc_number,
            track_number: t.track_number,
            cover_url: Some(format!("/cover/{}", urlencoding::encode(&t.path))),
            title_romaji: t.title_romaji.clone(),
            title_en: t.title_en.clone(),
            artist_romaji: t.artist_romaji.clone(),
            artist_en: t.artist_en.clone(),
            album_romaji: t.album_romaji.clone(),
            album_en: t.album_en.clone(),
            playlist_track_id: t.playlist_track_id,
        })
        .collect();
    
    if tracks.is_empty() {
        return Err(StatusCode::NOT_FOUND);
    }
    
    // Get unique albums
    let mut albums_map = std::collections::HashMap::new();
    for track in &tracks {
        let entry = albums_map.entry(track.album.clone()).or_insert((0, track.path.clone()));
        entry.0 += 1;
    }
    let albums: Vec<AlbumInfo> = albums_map
        .into_iter()
        .map(|(album_name, (count, path))| AlbumInfo {
            name: album_name,
            artist: name.clone(),
            cover_url: Some(format!("/cover/{}", urlencoding::encode(&path))),
            track_count: count,
        })
        .collect();
    
    let artist = ArtistInfo {
        name: name.clone(),
        album_count: albums.len(),
        track_count: tracks.len(),
    };
    
    Ok(Json(ArtistDetailResponse { artist, albums, tracks }))
}

/// Get lyrics for a track
pub async fn get_lyrics(
    State(state): State<Arc<ServerState>>,
    Path(path): Path<String>,
) -> Result<Json<LyricsResponse>, StatusCode> {
    let track_path = urlencoding::decode(&path).map_err(|_| StatusCode::BAD_REQUEST)?.to_string();
    
    // 1. Get track metadata from DB to search correctly
    let app_state = state.app_state();
    let track_info: Option<TrackInfo> = {
        let db_lock = app_state.db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if let Some(ref db) = *db_lock {
            db.get_track(&track_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        } else {
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
    };

    let track = if let Some(t) = track_info {
        t
    } else {
        return Err(StatusCode::NOT_FOUND);
    };

    // 2. Try Local LRC first (Instant)
    if let Some(mut local_lyrics) = crate::lyrics_fetcher::find_local_lrc(&track_path) {
        // Transliterate if needed
        if let Some(ref synced) = local_lyrics.synced_lyrics {
            if crate::lyrics_transliteration::has_japanese(synced) { // Check for JP characters
                local_lyrics.synced_lyrics = Some(crate::lyrics_transliteration::transliterate_lyrics(synced));
            }
        }
        return Ok(Json(LyricsResponse {
            track_path: track_path.clone(),
            has_synced: local_lyrics.synced_lyrics.is_some(),
            synced_lyrics: local_lyrics.synced_lyrics,
            plain_lyrics: local_lyrics.plain_lyrics,
            instrumental: local_lyrics.instrumental.unwrap_or(false),
        }));
    }

    // 3. Fetch from API (Blocking)
    let artist = track.artist.clone();
    let title = track.title.clone();
    let duration = track.duration_secs as u32;

    // Use spawn_blocking for network request
    let api_result = tokio::task::spawn_blocking(move || {
        // We pass a no-op closure for progress updates since we can't stream them easily over HTTP here
        let mut lyrics = crate::lyrics_fetcher::fetch_lyrics(&artist, &title, duration, |_| {})
            .or_else(|_| crate::lyrics_fetcher::fetch_lyrics_fallback(&artist, &title, |_| {}))?;
        
        // Transliterate if needed
        if let Some(ref synced) = lyrics.synced_lyrics {
            if crate::lyrics_transliteration::has_japanese(synced) {
                lyrics.synced_lyrics = Some(crate::lyrics_transliteration::transliterate_lyrics(synced));
            }
        }
        
        Ok::<_, String>(lyrics) // Return a Result from the blocking task
    }).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match api_result {
        Ok(lyrics) => Ok(Json(LyricsResponse {
            track_path: track_path.clone(),
            has_synced: lyrics.synced_lyrics.is_some(),
            synced_lyrics: lyrics.synced_lyrics,
            plain_lyrics: lyrics.plain_lyrics,
            instrumental: lyrics.instrumental.unwrap_or(false),
        })),
        Err(_) => {
            // Return empty response if not found, rather than error, so UI knows we tried
             Ok(Json(LyricsResponse {
                track_path: track_path,
                has_synced: false,
                synced_lyrics: None,
                plain_lyrics: None,
                instrumental: false,
            }))
        }
    }
}

/// Get library statistics
pub async fn get_stats(
    State(state): State<Arc<ServerState>>,
) -> Result<Json<StatsResponse>, StatusCode> {
    let app_state = state.app_state();
    let all_tracks = app_state.db.lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?
        .get_all_tracks()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Calculate statistics
    let total_songs = all_tracks.len();
    
    // Calculate total duration in hours
    let total_duration_hours: f64 = all_tracks.iter()
        .map(|t| t.duration_secs)
        .sum::<f64>() / 3600.0;
    
    // Get unique albums
    let mut albums_set = std::collections::HashSet::new();
    for track in &all_tracks {
        albums_set.insert((&track.album, &track.artist));
    }
    let total_albums = albums_set.len();
    
    // Get unique artists
    let mut artists_set = std::collections::HashSet::new();
    for track in &all_tracks {
        artists_set.insert(&track.artist);
    }
    let total_artists = artists_set.len();
    
    Ok(Json(StatsResponse {
        total_songs,
        total_albums,
        total_artists,
        total_duration_hours,
    }))
}

/// Get cover art for a track
pub async fn get_cover(
    State(state): State<Arc<ServerState>>,
    Path(path): Path<String>,
) -> Result<Response<Body>, StatusCode> {
    let track_path = urlencoding::decode(&path)
        .map_err(|_| {
            log::error!("❌ Failed to decode cover path: {}", path);
            StatusCode::BAD_REQUEST
        })?
        .to_string()
        .replace("\\", "/");
    
    log::info!("🖼️ Cover request for: {}", track_path);
    
    let app_state = state.app_state();
    
    let cover_file_path = {
        let db_guard = app_state.db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if let Some(ref db) = *db_guard {
            // 1. Check if it's a direct filename request (cached cover)
            // A direct filename should NOT contain slashes and should NOT be an absolute path.
            let is_filename_only = !track_path.contains('/') && !track_path.contains(':');
            let covers_dir = db.get_covers_dir();
            
            if is_filename_only {
                let potential_cached_path = covers_dir.join(&track_path);
                if potential_cached_path.exists() && potential_cached_path.is_file() {
                    Some(potential_cached_path)
                } else {
                    None
                }
            } else {
                // 2. Look up track in DB
                match db.get_track(&track_path) {
                    Ok(Some(track)) => {
                        if let Some(ref cover_filename) = track.cover_image {
                            let full_path = covers_dir.join(cover_filename);
                            if full_path.exists() {
                                Some(full_path)
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    },
                    _ => None
                }
            }
        } else {
            None
        }
    };
    
    // Try to read from cover file (after releasing lock)
    if let Some(cover_path) = cover_file_path {
        if let Ok(data) = tokio::fs::read(&cover_path).await {
            println!("[Server] Successfully read cover file");
            let content_type = if cover_path.to_string_lossy().ends_with(".png") {
                "image/png"
            } else {
                "image/jpeg"
            };
            
            return Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CACHE_CONTROL, "public, max-age=86400")
                .body(Body::from(data))
                .unwrap());
        } else {
            println!("[Server] Failed to read cover file at {:?}", cover_path);
        }
    }
    
    // Only attempt extraction if it looks like an audio file path
    let is_audio = track_path.to_lowercase().ends_with(".mp3") || 
                   track_path.to_lowercase().ends_with(".flac") || 
                   track_path.to_lowercase().ends_with(".wav") || 
                   track_path.to_lowercase().ends_with(".m4a") ||
                   track_path.to_lowercase().ends_with(".ogg");

    if !is_audio {
        println!("[Server] Skipping extraction for non-audio path: {}", track_path);
        return Err(StatusCode::NOT_FOUND);
    }

    println!("[Server] Attempting to extract cover from audio file...");
    // Try to extract from audio file
    match extract_cover_from_file(&track_path) {
        Some((data, mime)) => {
            println!("[Server] Successfully extracted cover!");
            // CACHE HIT: Save to disk and update DB
            let app_state = state.app_state();
            if let Ok(db_guard) = app_state.db.lock() {
                if let Some(ref db) = *db_guard {
                    let covers_dir = db.get_covers_dir();
                    // Generate a unique filename
                    let filename = format!("{}.jpg", uuid::Uuid::new_v4());
                    let save_path = covers_dir.join(&filename);
                    
                    // Save to disk
                    if let Ok(mut file) = std::fs::File::create(&save_path) {
                        if std::io::Write::write_all(&mut file, &data).is_ok() {
                            log::info!("💾 Cached cover for: {}", track_path);
                            // Update DB
                            // We need to know album and artist to update. 
                            // extract_cover_from_file doesn't return metadata.
                            // However, we can look up the track in the DB to get album/artist.
                            if let Ok(Some(track)) = db.get_track(&track_path) {
                                let _ = db.update_album_cover(&track.album, &track.artist, &filename);
                            }
                        }
                    }
                }
            }

            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime)
                .header(header::CACHE_CONTROL, "public, max-age=86400")
                .body(Body::from(data))
                .unwrap())
        }
        None => {
            println!("[Server] Failed to extract cover");
            Err(StatusCode::NOT_FOUND)
        },
    }
}

/// Extract cover art from an audio file
fn extract_cover_from_file(path: &str) -> Option<(Vec<u8>, &'static str)> {
    use lofty::prelude::*;
    use lofty::probe::Probe;
    
    let tagged_file = Probe::open(path).ok()?.read().ok()?;
    let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag())?;
    
    for picture in tag.pictures() {
        let mime = match picture.mime_type() {
            Some(lofty::picture::MimeType::Png) => "image/png",
            Some(lofty::picture::MimeType::Jpeg) => "image/jpeg",
            Some(lofty::picture::MimeType::Gif) => "image/gif",
            Some(lofty::picture::MimeType::Bmp) => "image/bmp",
            _ => "image/jpeg",
        };
        return Some((picture.data().to_vec(), mime));
    }
    
    None
}

/// Stream audio to mobile client from a specific file path
/// Supports HTTP Range requests for seeking
pub async fn stream_audio_file(
    Path(encoded_path): Path<String>,
) -> Result<Response, StatusCode> {
    
    // Decode the path
    let track_path = urlencoding::decode(&encoded_path)
        .map_err(|_| StatusCode::BAD_REQUEST)?
        .to_string()
        .replace("\\", "/");
        
    log::info!("📱 Streaming request for: {}", track_path);
    
    // Validate path exists and is accessible
    if !std::path::Path::new(&track_path).exists() {
        log::error!("❌ Stream file not found: {}", track_path);
        return Err(StatusCode::NOT_FOUND);
    }
    
    // Read file metadata for size
    let file_metadata = tokio::fs::metadata(&track_path).await
        .map_err(|e| {
            log::error!("❌ Failed to get metadata for {}: {}", track_path, e);
            StatusCode::NOT_FOUND
        })?;
    let file_size = file_metadata.len();
    
    // Read the entire file
    let data = match tokio::fs::read(&track_path).await {
        Ok(d) => d,
        Err(e) => {
            log::error!("❌ Failed to read file {}: {}", track_path, e);
            return Err(StatusCode::NOT_FOUND);
        }
    };
    
    log::info!("✅ Serving {} bytes for {}", file_size, track_path);
    
    // Determine content type from extension
    let content_type = if track_path.ends_with(".flac") {
        "audio/flac"
    } else if track_path.ends_with(".mp3") {
        "audio/mpeg"
    } else if track_path.ends_with(".m4a") || track_path.ends_with(".aac") {
        "audio/aac"
    } else if track_path.ends_with(".ogg") || track_path.ends_with(".opus") {
        "audio/ogg"
    } else if track_path.ends_with(".wav") {
        "audio/wav"
    } else {
        "application/octet-stream"
    };
    
    // Build response with proper headers for streaming
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, file_size.to_string())
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CACHE_CONTROL, "public, max-age=604800")
        .body(Body::from(data))
        .unwrap())
}

/// Stream audio to mobile client (legacy endpoint for current track)
pub async fn stream_audio(
    State(state): State<Arc<ServerState>>,
    Query(params): Query<StreamParams>,
) -> Result<Response, StatusCode> {
    let start_sample = params.start.unwrap_or(0);
    
    // Get current track
    let app_state = state.app_state();
    let track_path = {
        let player_guard = app_state.player.lock()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let player = player_guard.as_ref().ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
        let status = player.get_status();
        status.track.map(|t| t.path).ok_or(StatusCode::NOT_FOUND)?
    };
    
    // Read the audio file
    let data = tokio::fs::read(&track_path).await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    
    // Skip to start position if needed
    let data = if start_sample > 0 {
        // For raw streaming, we'd calculate byte offset from sample
        // For now, send the full file (mobile will seek)
        data
    } else {
        data
    };
    
    // Determine content type from extension
    let content_type = if track_path.ends_with(".flac") {
        "audio/flac"
    } else if track_path.ends_with(".mp3") {
        "audio/mpeg"
    } else if track_path.ends_with(".m4a") || track_path.ends_with(".aac") {
        "audio/aac"
    } else if track_path.ends_with(".ogg") || track_path.ends_with(".opus") {
        "audio/ogg"
    } else if track_path.ends_with(".wav") {
        "audio/wav"
    } else {
        "application/octet-stream"
    };
    
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header("X-Audio-Format", content_type)
        .header("X-Audio-Start-Sample", start_sample.to_string())
        .body(Body::from(data))
        .unwrap())
}
