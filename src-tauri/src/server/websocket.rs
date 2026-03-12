//! WebSocket handler for real-time control between PC and mobile clients.
//!
//! ## Protocol
//!
//! 1. Mobile connects to `ws://<ip>:5000/control`
//! 2. Mobile sends `hello` with its name
//! 3. Server replies with `connected` + full state (`mediaSession`, `status`, `queueUpdate`)
//! 4. Mobile sends commands (`play`, `pause`, `next`, …)
//! 5. Server replies to the requesting client via **direct** channel
//! 6. Server broadcasts state changes to **all** clients via broadcast channel
//!
//! ### Delivery paths
//!
//! - `reply_tx` — direct replies to the client that sent the command
//! - `event_tx` — broadcast to every connected client (periodic status, track changes)

use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::Response,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use super::{ConnectedClient, ServerEvent, ServerState};

// ─── Client → Server Messages ────────────────────────────────────────────────

/// Every JSON message the mobile client can send.
/// The `type` field is used as the discriminator (camelCase).
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientMessage {
    // Handshake
    Hello { client_name: String },
    GetStatus,

    // Playback controls
    Play,
    Pause,
    Resume,
    Stop,
    Next,
    Previous,
    Seek { position_secs: f64 },
    SetVolume { volume: f64 },
    ToggleShuffle,
    CycleRepeat,

    // Track / queue
    PlayTrack { path: String },
    PlayAlbum { album: String, artist: String },
    PlayArtist { artist: String },
    AddToQueue { path: String },
    SetQueue { paths: Vec<String> },
    ToggleFavorite { path: String },

    // Library
    GetLibrary,
    GetLyrics,

    // Mobile streaming
    StartMobilePlayback,
    StopMobilePlayback,
    MobilePositionUpdate { position_secs: f64 },

    // Playlists
    GetPlaylists,
    GetPlaylistTracks { playlist_id: String },
    AddToPlaylist { playlist_id: String, path: String },
    RemoveFromPlaylist { playlist_id: String, playlist_track_id: i64 },
    ReorderPlaylistTracks { playlist_id: String, track_ids: Vec<i64> },

    // Keepalive
    Ping,
}

// ─── Server → Client Messages ────────────────────────────────────────────────

/// Every JSON message the server can send to a client.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerMessage {
    /// Sent once after `hello` to confirm the connection.
    #[serde(rename = "connected")]
    Connected {
        #[serde(rename = "clientId")]
        client_id: String,
    },

    /// Current track metadata.
    #[serde(rename_all = "camelCase")]
    MediaSession {
        track_id: String,
        title: String,
        artist: String,
        album: String,
        duration: f64,
        cover_url: Option<String>,
        title_romaji: Option<String>,
        title_en: Option<String>,
        artist_romaji: Option<String>,
        artist_en: Option<String>,
        album_romaji: Option<String>,
        album_en: Option<String>,
        is_playing: bool,
        position: f64,
        timestamp: u64,
    },

    /// Player status (volume, shuffle, repeat, active output).
    #[serde(rename_all = "camelCase")]
    Status {
        volume: f64,
        shuffle: bool,
        repeat_mode: String,
        output: String,
    },

    /// Lightweight position update during playback.
    #[serde(rename = "PlaybackState")]
    PlaybackState {
        #[serde(rename = "is_playing")]
        is_playing: bool,
        position: f64,
        volume: f64,
    },

    /// Lyrics for the current track.
    #[serde(rename_all = "camelCase")]
    Lyrics {
        track_path: String,
        has_synced: bool,
        synced_lyrics: Option<String>,
        #[serde(rename = "syncedLyricsRomaji")]
        synced_lyrics_romaji: Option<String>,
        plain_lyrics: Option<String>,
        instrumental: bool,
    },

    /// Tells mobile to start streaming from the given URL at the given sample offset.
    #[serde(rename_all = "camelCase")]
    HandoffPrepare { sample: u64, url: String },

    /// Tells mobile that streaming has been stopped (returned to desktop).
    StreamStopped,

    /// Full library of tracks.
    #[serde(rename_all = "camelCase")]
    Library { tracks: Vec<super::routes::TrackDetail> },

    /// Current playback queue with cursor position.
    #[serde(rename_all = "camelCase")]
    QueueUpdate {
        queue: Vec<super::TrackSummary>,
        #[serde(rename = "currentIndex")]
        current_index: i32,
    },

    /// List of playlists.
    #[serde(rename_all = "camelCase")]
    Playlists { playlists: Vec<PlaylistResponse> },

    /// Tracks inside a specific playlist.
    #[serde(rename_all = "camelCase")]
    PlaylistTracks {
        #[serde(rename = "playlistId")]
        playlist_id: String,
        tracks: Vec<super::routes::TrackDetail>,
    },

    /// Notification that playback stats were updated.
    #[serde(rename_all = "camelCase")]
    StatsUpdated { timestamp: i64 },

    /// Acknowledge a successful action.
    Ack { action: String },

    /// Error description.
    Error { message: String },

    /// Keepalive response.
    Pong,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistResponse {
    pub id: String,
    pub name: String,
    #[serde(rename = "trackCount")]
    pub track_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

// ─── ServerEvent → ServerMessage conversion ──────────────────────────────────

impl From<ServerEvent> for ServerMessage {
    fn from(event: ServerEvent) -> Self {
        match event {
            ServerEvent::MediaSession {
                track_id, title, artist, album, duration, cover_url,
                title_romaji, title_en, artist_romaji, artist_en, album_romaji, album_en,
                is_playing, position, timestamp,
            } => ServerMessage::MediaSession {
                track_id, title, artist, album, duration, cover_url,
                title_romaji, title_en, artist_romaji, artist_en, album_romaji, album_en,
                is_playing, position, timestamp,
            },
            ServerEvent::PositionUpdate { position, is_playing, volume, .. } => ServerMessage::PlaybackState {
                is_playing,
                position,
                volume,
            },
            ServerEvent::Status { volume, shuffle, repeat_mode, output } => {
                ServerMessage::Status { volume, shuffle, repeat_mode, output }
            }
            ServerEvent::QueueUpdate { tracks, current_index } => {
                ServerMessage::QueueUpdate { queue: tracks, current_index }
            }
            ServerEvent::Lyrics { track_path, has_synced, synced_lyrics, synced_lyrics_romaji, plain_lyrics, instrumental } => {
                ServerMessage::Lyrics { track_path, has_synced, synced_lyrics, synced_lyrics_romaji, plain_lyrics, instrumental }
            }
            ServerEvent::HandoffPrepare { sample, url } => {
                ServerMessage::HandoffPrepare { sample, url }
            }
            ServerEvent::StreamStopped => ServerMessage::StreamStopped,
            ServerEvent::StatsUpdated { timestamp } => ServerMessage::StatsUpdated { timestamp },
            ServerEvent::Error { message } => ServerMessage::Error { message },
            ServerEvent::Pong => ServerMessage::Pong,
        }
    }
}

// ─── WebSocket upgrade & connection lifecycle ────────────────────────────────

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<ServerState>>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<ServerState>) {
    let (mut sender, mut receiver) = socket.split();

    let mut event_rx = state.event_tx.subscribe();
    let client_id = uuid::Uuid::new_v4().to_string();
    let client_id_for_cleanup = client_id.clone();
    let app_handle = state.app_handle.clone();

    log::info!("[WS] New connection, client_id={}", client_id);

    // Direct replies to this specific client
    let (reply_tx, mut reply_rx) = tokio::sync::mpsc::channel::<ServerMessage>(32);
    // Signal the send task to stop
    let (stop_tx, mut stop_rx) = tokio::sync::mpsc::channel::<()>(1);

    // ── Send task ────────────────────────────────────────────────────────────
    // Forwards broadcast events + direct replies + keepalive pings to the client.
    let send_task = tokio::spawn(async move {
        let mut keepalive = tokio::time::interval(std::time::Duration::from_secs(30));

        loop {
            tokio::select! {
                event = event_rx.recv() => {
                    match event {
                        Ok(ev) => {
                            let json = serde_json::to_string(&ServerMessage::from(ev)).unwrap();
                            if sender.send(Message::Text(json)).await.is_err() { break; }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                            log::warn!("[WS] Client lagged, skipped {} messages", n);
                            // Continue — client will catch up via next broadcast
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                    }
                }
                reply = reply_rx.recv() => {
                    match reply {
                        Some(msg) => {
                            let json = serde_json::to_string(&msg).unwrap();
                            if sender.send(Message::Text(json)).await.is_err() { break; }
                        }
                        None => break,
                    }
                }
                _ = keepalive.tick() => {
                    let json = serde_json::to_string(&ServerMessage::Pong).unwrap();
                    if sender.send(Message::Text(json)).await.is_err() { break; }
                }
                _ = stop_rx.recv() => break,
            }
        }
    });

    // ── Receive loop ─────────────────────────────────────────────────────────
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(client_msg) => {
                        log::debug!("[WS] {} -> {:?}", client_id, client_msg);
                        handle_client_message(&state, &client_id, client_msg, &reply_tx).await;
                    }
                    Err(e) => {
                        log::warn!("[WS] Bad message from {}: {}", client_id, e);
                        let _ = reply_tx.send(ServerMessage::Error {
                            message: format!("Invalid message: {}", e),
                        }).await;
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    // ── Cleanup ──────────────────────────────────────────────────────────────
    let _ = stop_tx.send(()).await;
    send_task.abort();

    let mut clients = state.clients.write().await;
    let disconnected = clients.iter().find(|c| c.id == client_id_for_cleanup).cloned();
    clients.retain(|c| c.id != client_id_for_cleanup);

    if let Some(client) = disconnected {
        let _ = app_handle.emit("mobile_client_disconnected", serde_json::json!({
            "client_id": client.id,
            "client_name": client.name,
        }));
        log::info!("[WS] Client disconnected: {} ({})", client.name, client.id);
    }
}

// ─── Message dispatch ────────────────────────────────────────────────────────

async fn handle_client_message(
    state: &Arc<ServerState>,
    client_id: &str,
    msg: ClientMessage,
    reply_tx: &tokio::sync::mpsc::Sender<ServerMessage>,
) {
    let app_state = state.app_state();

    match msg {
        // ── Handshake ────────────────────────────────────────────────────
        ClientMessage::Hello { client_name } => {
            log::info!("[WS] Hello from '{}' ({})", client_name, client_id);

            state.clients.write().await.push(ConnectedClient {
                id: client_id.to_string(),
                name: client_name.clone(),
                remote_ip: String::new(),
                connected_at: std::time::Instant::now(),
            });

            let _ = state.app_handle.emit("mobile_client_connected", serde_json::json!({
                "client_id": client_id,
                "client_name": client_name,
            }));

            let _ = reply_tx.send(ServerMessage::Connected {
                client_id: client_id.to_string(),
            }).await;

            // Send full current state to this client only
            send_full_state(state, &app_state, reply_tx).await;
        }

        ClientMessage::GetStatus => {
            send_full_state(state, &app_state, reply_tx).await;
        }

        // ── Playback: Play / Resume ──────────────────────────────────────
        ClientMessage::Play | ClientMessage::Resume => {
            if let Ok(mut g) = app_state.player.lock() {
                if let Some(ref mut p) = *g { let _ = p.resume(); }
            }
            sync_discord(state, &app_state).await;
            broadcast_player_state(state, &app_state).await;
        }

        // ── Playback: Pause / Stop ───────────────────────────────────────
        ClientMessage::Pause | ClientMessage::Stop => {
            if let Ok(mut g) = app_state.player.lock() {
                if let Some(ref mut p) = *g { let _ = p.pause(); }
            }
            sync_discord(state, &app_state).await;
            broadcast_player_state(state, &app_state).await;
        }

        // ── Next / Previous ──────────────────────────────────────────────
        ClientMessage::Next => {
            let next_path = advance_queue(&app_state, 1);
            if let Some(path) = next_path {
                play_track_internal(state, &app_state, path, reply_tx).await;
            } else {
                let _ = reply_tx.send(ServerMessage::Error {
                    message: "Queue is empty".to_string(),
                }).await;
            }
        }

        ClientMessage::Previous => {
            let prev_path = advance_queue(&app_state, -1);
            if let Some(path) = prev_path {
                play_track_internal(state, &app_state, path, reply_tx).await;
            }
        }

        // ── Seek ─────────────────────────────────────────────────────────
        ClientMessage::Seek { position_secs } => {
            if let Ok(mut g) = app_state.player.lock() {
                if let Some(ref mut p) = *g { let _ = p.seek(position_secs); }
            }
            sync_discord(state, &app_state).await;
            broadcast_player_state(state, &app_state).await;
        }

        // ── Volume ───────────────────────────────────────────────────────
        ClientMessage::SetVolume { volume } => {
            if let Ok(mut g) = app_state.player.lock() {
                if let Some(ref mut p) = *g { let _ = p.set_volume(volume as f32); }
            }
            broadcast_player_state(state, &app_state).await;
        }

        // ── Shuffle / Repeat ─────────────────────────────────────────────
        ClientMessage::ToggleShuffle => {
            {
                let mut s = app_state.shuffle.lock().unwrap();
                *s = !*s;
            }
            broadcast_player_state(state, &app_state).await;
        }

        ClientMessage::CycleRepeat => {
            {
                let mut r = app_state.repeat_mode.lock().unwrap();
                *r = match r.as_str() {
                    "off" => "all".to_string(),
                    "all" => "one".to_string(),
                    _ => "off".to_string(),
                };
            }
            broadcast_player_state(state, &app_state).await;
        }

        // ── Play a specific track ────────────────────────────────────────
        ClientMessage::PlayTrack { path } => {
            play_track_internal(state, &app_state, path, reply_tx).await;
        }

        // ── Play all tracks of an album ──────────────────────────────────
        ClientMessage::PlayAlbum { album, artist } => {
            let tracks = get_sorted_tracks(&app_state, |t| {
                t.album == album && (artist.is_empty() || t.artist == artist)
            });
            if let Some(first) = tracks.first() {
                let first_path = first.path.clone();
                set_queue(&app_state, tracks);
                play_track_internal(state, &app_state, first_path, reply_tx).await;
                broadcast_queue(state, &app_state).await;
            } else {
                let _ = reply_tx.send(ServerMessage::Error {
                    message: "Album not found or empty".to_string(),
                }).await;
            }
        }

        // ── Play all tracks of an artist ─────────────────────────────────
        ClientMessage::PlayArtist { artist } => {
            let tracks = get_sorted_tracks(&app_state, |t| t.artist == artist);
            if let Some(first) = tracks.first() {
                let first_path = first.path.clone();
                set_queue(&app_state, tracks);
                play_track_internal(state, &app_state, first_path, reply_tx).await;
                broadcast_queue(state, &app_state).await;
            } else {
                let _ = reply_tx.send(ServerMessage::Error {
                    message: "Artist not found or empty".to_string(),
                }).await;
            }
        }

        // ── Queue manipulation ───────────────────────────────────────────
        ClientMessage::SetQueue { paths } => {
            let tracks = {
                let db_guard = app_state.db.lock().unwrap();
                if let Some(ref db) = *db_guard {
                    if let Ok(all) = db.get_all_tracks() {
                        paths.iter().filter_map(|p| all.iter().find(|t| &t.path == p).cloned()).collect()
                    } else { Vec::new() }
                } else { Vec::new() }
            };
            set_queue(&app_state, tracks);
            broadcast_queue(state, &app_state).await;
        }

        ClientMessage::AddToQueue { path } => {
            let track = {
                let db_guard = app_state.db.lock().unwrap();
                db_guard.as_ref().and_then(|db| {
                    db.get_all_tracks().ok().and_then(|all| all.into_iter().find(|t| t.path == path))
                })
            };
            if let Some(t) = track {
                app_state.queue.lock().unwrap().push(t);
                broadcast_queue(state, &app_state).await;
            }
        }

        // ── Favorites ────────────────────────────────────────────────────
        ClientMessage::ToggleFavorite { path } => {
            log::info!("[WS] ToggleFavorite for {} (not yet implemented in DB)", path);
            let _ = reply_tx.send(ServerMessage::Ack {
                action: "toggleFavorite".to_string(),
            }).await;
        }

        // ── Library ──────────────────────────────────────────────────────
        ClientMessage::GetLibrary => {
            let tracks = build_track_details(&app_state);
            let _ = reply_tx.send(ServerMessage::Library { tracks }).await;
        }

        // ── Lyrics ───────────────────────────────────────────────────────
        ClientMessage::GetLyrics => {
            let current_track = {
                app_state.player.lock().ok().and_then(|g| {
                    g.as_ref().and_then(|p| p.get_status().track)
                })
            };

            if let Some(track) = current_track {
                let reply = reply_tx.clone();
                let artist = track.artist.clone();
                let title = track.title.clone();
                let duration = track.duration_secs as u32;
                let path = track.path.clone();

                tokio::task::spawn_blocking(move || {
                    // Try local .lrc first
                    if let Some(lrc) = crate::lyrics_fetcher::find_local_lrc(&path) {
                        let _ = reply.blocking_send(ServerMessage::Lyrics {
                            track_path: path,
                            has_synced: lrc.synced_lyrics.is_some(),
                            synced_lyrics: lrc.synced_lyrics.clone(),
                            synced_lyrics_romaji: lrc.synced_lyrics.as_ref().and_then(|t| {
                                if crate::lyrics_transliteration::has_japanese(t) {
                                    Some(crate::lyrics_transliteration::transliterate_lyrics(t))
                                } else { None }
                            }),
                            plain_lyrics: lrc.plain_lyrics,
                            instrumental: lrc.instrumental.unwrap_or(false),
                        });
                        return;
                    }

                    // Fetch from API
                    match crate::lyrics_fetcher::fetch_lyrics(&artist, &title, duration, |_| {}) {
                        Ok(lyrics) => {
                            let _ = reply.blocking_send(ServerMessage::Lyrics {
                                track_path: path,
                                has_synced: lyrics.synced_lyrics.is_some(),
                                synced_lyrics: lyrics.synced_lyrics.clone(),
                                synced_lyrics_romaji: lyrics.synced_lyrics.as_ref().and_then(|t| {
                                    if crate::lyrics_transliteration::has_japanese(t) {
                                        Some(crate::lyrics_transliteration::to_romaji(t))
                                    } else { None }
                                }),
                                plain_lyrics: lyrics.plain_lyrics,
                                instrumental: lyrics.instrumental.unwrap_or(false),
                            });
                        }
                        Err(e) => {
                            log::warn!("Failed to fetch lyrics: {}", e);
                            let _ = reply.blocking_send(ServerMessage::Error {
                                message: "Lyrics not found".to_string(),
                            });
                        }
                    }
                });
            } else {
                let _ = reply_tx.send(ServerMessage::Error {
                    message: "No track playing".to_string(),
                }).await;
            }
        }

        // ── Mobile streaming: start ──────────────────────────────────────
        ClientMessage::StartMobilePlayback => {
            log::info!("[WS] StartMobilePlayback from {}", client_id);

            // Finalize any active desktop stats session
            finalize_desktop_stats(&app_state, state).await;

            // Switch output to mobile
            *state.active_output.write().await = "mobile".to_string();

            // Pause PC playback
            if let Ok(mut g) = app_state.player.lock() {
                if let Some(ref mut p) = *g { let _ = p.pause(); }
            }

            // Build & send stream URL
            if let Some((path, position)) = current_track_info(&app_state) {
                let url = build_stream_url(state, &path);
                let _ = reply_tx.send(ServerMessage::HandoffPrepare {
                    sample: (position * 44100.0) as u64,
                    url,
                }).await;

                let _ = state.app_handle.emit("output-changed", serde_json::json!({
                    "output": "mobile"
                }));
            } else {
                let _ = reply_tx.send(ServerMessage::Error {
                    message: "No track currently playing".to_string(),
                }).await;
            }
        }

        // ── Mobile streaming: stop ───────────────────────────────────────
        ClientMessage::StopMobilePlayback => {
            log::info!("[WS] StopMobilePlayback from {}", client_id);

            // Finalize mobile stats session
            if let Ok(mut tracker) = app_state.stats_tracker.lock() {
                let now_ms = crate::stats::current_time_ms();
                if let Some(event) = tracker.stop_mobile(now_ms) {
                    let _ = crate::stats::record_stats_event(&app_state, &state.app_handle, event);
                    state.broadcast(ServerEvent::StatsUpdated { timestamp: now_ms });
                    let _ = state.app_handle.emit("stats-updated", ());
                }
            }

            // Switch back to desktop
            *state.active_output.write().await = "desktop".to_string();

            // Resume PC playback
            if let Ok(mut g) = app_state.player.lock() {
                if let Some(ref mut p) = *g {
                    let _ = p.set_mute(false);
                    let _ = p.resume();
                }
            }

            state.broadcast(ServerEvent::StreamStopped);

            let _ = state.app_handle.emit("output-changed", serde_json::json!({
                "output": "desktop"
            }));
        }

        // ── Mobile position updates ──────────────────────────────────────
        ClientMessage::MobilePositionUpdate { position_secs } => {
            // Update stats tracker
            if let Ok(mut tracker) = app_state.stats_tracker.lock() {
                let now_ms = crate::stats::current_time_ms();
                let song_id = app_state.player.lock().ok().and_then(|g| {
                    g.as_ref().and_then(|p| p.get_status().track.map(|t| t.path))
                });
                if let Some(event) = tracker.update_mobile_position(song_id, position_secs, now_ms) {
                    let _ = crate::stats::record_stats_event(&app_state, &state.app_handle, event);
                    state.broadcast(ServerEvent::StatsUpdated { timestamp: now_ms });
                    let _ = state.app_handle.emit("stats-updated", ());
                }
            }
            // Sync with React frontend
            let _ = state.app_handle.emit("mobile-position-update", serde_json::json!({
                "position_secs": position_secs,
            }));
        }

        // ── Playlists ────────────────────────────────────────────────────
        ClientMessage::GetPlaylists => {
            let playlists = build_playlists_list(&app_state);
            let _ = reply_tx.send(ServerMessage::Playlists { playlists }).await;
        }

        ClientMessage::GetPlaylistTracks { playlist_id } => {
            let tracks = build_playlist_track_details(&app_state, &playlist_id);
            let _ = reply_tx.send(ServerMessage::PlaylistTracks { playlist_id, tracks }).await;
        }

        ClientMessage::AddToPlaylist { playlist_id, path } => {
            let ok = {
                let db_guard = app_state.db.lock().unwrap();
                db_guard.as_ref().is_some_and(|db| db.add_track_to_playlist(&playlist_id, &path).is_ok())
            };
            if ok {
                let _ = reply_tx.send(ServerMessage::Ack { action: "addToPlaylist".to_string() }).await;
            } else {
                let _ = reply_tx.send(ServerMessage::Error { message: "Failed to add track".to_string() }).await;
            }
        }

        ClientMessage::RemoveFromPlaylist { playlist_id, playlist_track_id } => {
            let ok = {
                let db_guard = app_state.db.lock().unwrap();
                db_guard.as_ref().is_some_and(|db| db.remove_track_from_playlist(&playlist_id, playlist_track_id).is_ok())
            };
            if ok {
                let _ = reply_tx.send(ServerMessage::Ack { action: "removeFromPlaylist".to_string() }).await;
            } else {
                let _ = reply_tx.send(ServerMessage::Error { message: "Failed to remove track".to_string() }).await;
            }
        }

        ClientMessage::ReorderPlaylistTracks { playlist_id, track_ids } => {
            let ok = {
                let db_guard = app_state.db.lock().unwrap();
                db_guard.as_ref().is_some_and(|db| db.reorder_playlist_tracks(&playlist_id, track_ids).is_ok())
            };
            if ok {
                let _ = reply_tx.send(ServerMessage::Ack { action: "reorderPlaylistTracks".to_string() }).await;
            } else {
                let _ = reply_tx.send(ServerMessage::Error { message: "Failed to reorder tracks".to_string() }).await;
            }
        }

        // ── Keepalive ────────────────────────────────────────────────────
        ClientMessage::Ping => {
            let _ = reply_tx.send(ServerMessage::Pong).await;
        }
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Helper functions
// ═════════════════════════════════════════════════════════════════════════════

/// Send the full player state directly to one client (media + status + queue).
async fn send_full_state(
    state: &Arc<ServerState>,
    app_state: &tauri::State<'_, crate::AppState>,
    reply_tx: &tokio::sync::mpsc::Sender<ServerMessage>,
) {
    let (media, status) = build_state_events(state, app_state).await;

    let _ = reply_tx.send(media.into()).await;
    let _ = reply_tx.send(status.into()).await;
    let _ = reply_tx.send(build_queue_message(app_state)).await;

    // Tell the Tauri frontend to refresh
    let _ = state.app_handle.emit("refresh-player-state", ());
}

/// Broadcast player state to **all** connected clients.
async fn broadcast_player_state(
    state: &Arc<ServerState>,
    app_state: &tauri::State<'_, crate::AppState>,
) {
    let (media, status) = build_state_events(state, app_state).await;
    state.broadcast(media);
    state.broadcast(status);
    let _ = state.app_handle.emit("refresh-player-state", ());
}

/// Broadcast queue update to all clients.
async fn broadcast_queue(
    state: &Arc<ServerState>,
    app_state: &tauri::State<'_, crate::AppState>,
) {
    let (tracks, index) = read_queue(app_state);
    state.broadcast(ServerEvent::QueueUpdate { tracks, current_index: index as i32 });
}

/// Public entry point for the periodic broadcast task in `mod.rs`.
pub async fn send_current_status_with_handle(state: &Arc<ServerState>, app_handle: &AppHandle) {
    let app_state: tauri::State<'_, crate::AppState> = app_handle.state();
    let (media, status) = build_state_events(state, &app_state).await;
    state.broadcast(media);
    state.broadcast(status);
}

// ─── Track / queue helpers ───────────────────────────────────────────────────

/// Advance the queue by `delta` positions (+1 = next, -1 = previous).
/// Returns the path to play, or `None` if the queue is empty.
fn advance_queue(
    app_state: &tauri::State<'_, crate::AppState>,
    delta: i32,
) -> Option<String> {
    let queue = app_state.queue.lock().unwrap();
    if queue.is_empty() { return None; }

    let mut index = app_state.current_queue_index.lock().unwrap();
    let repeat = app_state.repeat_mode.lock().unwrap();
    let len = queue.len() as i32;

    let mut next = *index as i32 + delta;
    if next >= len {
        match repeat.as_str() {
            "all" => next = 0,
            "one" => next = *index as i32,
            _ => return None, // repeat off: stop at end
        }
    } else if next < 0 {
        match repeat.as_str() {
            "all" => next = len - 1,
            "one" => next = *index as i32,
            _ => next = 0, // repeat off: stay at first track
        }
    }
    *index = next as usize;
    Some(queue[next as usize].path.clone())
}

/// Load and optionally start playback of a track, handling both desktop and mobile output.
async fn play_track_internal(
    state: &Arc<ServerState>,
    app_state: &tauri::State<'_, crate::AppState>,
    path: String,
    reply_tx: &tokio::sync::mpsc::Sender<ServerMessage>,
) {
    let is_mobile = state.active_output.read().await.as_str() == "mobile";

    // Fetch enriched track from DB
    let track_info = {
        let db_guard = app_state.db.lock().unwrap();
        db_guard.as_ref().and_then(|db| db.get_track(&path).unwrap_or(None))
    };

    // Load into player
    if let Ok(mut g) = app_state.player.lock() {
        if let Some(ref mut player) = *g {
            let track = track_info.clone().unwrap_or_else(|| crate::audio::TrackInfo {
                path: path.clone(),
                ..crate::audio::TrackInfo::default()
            });
            if is_mobile {
                let _ = player.load_track(track);
            } else {
                let _ = player.play_track(track);
            }
        }
    }

    // Update queue index (or seed the queue if empty) without holding locks across await.
    let should_broadcast_queue = {
        let mut queue = app_state.queue.lock().unwrap();
        let mut index = app_state.current_queue_index.lock().unwrap();

        if queue.is_empty() {
            if let Some(t) = track_info {
                *queue = vec![t];
                *index = 0;
                true
            } else {
                false
            }
        } else if let Some(i) = queue.iter().position(|t| t.path == path) {
            *index = i;
            false
        } else {
            false
        }
    };

    if should_broadcast_queue {
        broadcast_queue(state, app_state).await;
    }

    // For mobile: send the stream URL
    if is_mobile {
        // Tell mobile to tear down current stream first
        let _ = reply_tx.send(ServerMessage::StreamStopped).await;

        let url = build_stream_url(state, &path);
        let _ = reply_tx.send(ServerMessage::HandoffPrepare { sample: 0, url }).await;
    }

    sync_discord(state, app_state).await;
    broadcast_player_state(state, app_state).await;
}

/// Build a MediaSession + Status event pair from the current player state.
async fn build_state_events(
    state: &Arc<ServerState>,
    app_state: &tauri::State<'_, crate::AppState>,
) -> (ServerEvent, ServerEvent) {
    let (track_id, title, artist, album, duration, cover_url,
         title_romaji, title_en, artist_romaji, artist_en, album_romaji, album_en,
         is_playing, position, volume) = {
        app_state.player.lock().ok().map(|g| {
            g.as_ref().map(|player| {
                let s = player.get_status();
                let playing = s.state == crate::audio::PlayerState::Playing;
                let pos = s.position_secs;
                let vol = s.volume;
                if let Some(ref t) = s.track {
                    (t.path.clone(), t.title.clone(), t.artist.clone(), t.album.clone(),
                     t.duration_secs,
                     Some(format!("/cover/{}", urlencoding::encode(t.cover_image.as_deref().unwrap_or(&t.path)))),
                     t.title_romaji.clone(), t.title_en.clone(),
                     t.artist_romaji.clone(), t.artist_en.clone(),
                     t.album_romaji.clone(), t.album_en.clone(),
                     playing, pos, vol)
                } else {
                    (String::new(), String::new(), String::new(), String::new(), 0.0, None,
                     None, None, None, None, None, None, false, 0.0, vol)
                }
            }).unwrap_or_else(|| {
                (String::new(), String::new(), String::new(), String::new(), 0.0, None,
                 None, None, None, None, None, None, false, 0.0, 1.0)
            })
        }).unwrap_or_else(|| {
            (String::new(), String::new(), String::new(), String::new(), 0.0, None,
             None, None, None, None, None, None, false, 0.0, 1.0)
        })
    };

    let output = state.active_output.read().await.clone();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
    let (shuffle, repeat_mode) = {
        let s = *app_state.shuffle.lock().unwrap();
        let r = app_state.repeat_mode.lock().unwrap().clone();
        (s, r)
    };

    (
        ServerEvent::MediaSession {
            track_id, title, artist, album, duration, cover_url,
            title_romaji, title_en, artist_romaji, artist_en, album_romaji, album_en,
            is_playing, position, timestamp,
        },
        ServerEvent::Status {
            volume: volume as f64,
            shuffle,
            repeat_mode,
            output,
        },
    )
}

/// Read the current queue & index, mapping to `TrackSummary`.
fn read_queue(app_state: &tauri::State<'_, crate::AppState>) -> (Vec<super::TrackSummary>, usize) {
    let queue = app_state.queue.lock().unwrap();
    let index = *app_state.current_queue_index.lock().unwrap();
    let tracks = queue.iter().map(|t| super::TrackSummary {
        path: t.path.clone(),
        title: t.title.clone(),
        artist: t.artist.clone(),
        album: t.album.clone(),
        duration_secs: t.duration_secs,
        cover_url: Some(format!("/cover/{}", urlencoding::encode(t.cover_image.as_deref().unwrap_or(&t.path)))),
        title_romaji: t.title_romaji.clone(),
        title_en: t.title_en.clone(),
        artist_romaji: t.artist_romaji.clone(),
        artist_en: t.artist_en.clone(),
        album_romaji: t.album_romaji.clone(),
        album_en: t.album_en.clone(),
    }).collect();
    (tracks, index)
}

/// Build a `QueueUpdate` server message.
fn build_queue_message(app_state: &tauri::State<'_, crate::AppState>) -> ServerMessage {
    let (tracks, index) = read_queue(app_state);
    ServerMessage::QueueUpdate { queue: tracks, current_index: index as i32 }
}

/// Replace the entire queue and reset the index.
fn set_queue(app_state: &tauri::State<'_, crate::AppState>, tracks: Vec<crate::audio::TrackInfo>) {
    let mut q = app_state.queue.lock().unwrap();
    let mut i = app_state.current_queue_index.lock().unwrap();
    *q = tracks;
    *i = 0;
}

/// Fetch sorted tracks from DB matching a predicate.
fn get_sorted_tracks(
    app_state: &tauri::State<'_, crate::AppState>,
    predicate: impl Fn(&crate::audio::TrackInfo) -> bool,
) -> Vec<crate::audio::TrackInfo> {
    let db_guard = app_state.db.lock().unwrap();
    if let Some(ref db) = *db_guard {
        if let Ok(all) = db.get_all_tracks() {
            let mut filtered: Vec<_> = all.into_iter().filter(|t| predicate(t)).collect();
            filtered.sort_by(|a, b| {
                a.album.cmp(&b.album)
                    .then(a.disc_number.cmp(&b.disc_number))
                    .then(a.track_number.cmp(&b.track_number))
            });
            return filtered;
        }
    }
    Vec::new()
}

/// Build full `TrackDetail` list from DB.
fn build_track_details(app_state: &tauri::State<'_, crate::AppState>) -> Vec<super::routes::TrackDetail> {
    let db_guard = app_state.db.lock().unwrap();
    if let Some(ref db) = *db_guard {
        if let Ok(all) = db.get_all_tracks() {
            return all.into_iter().map(|t| track_to_detail(&t)).collect();
        }
    }
    Vec::new()
}

/// Build the playlists list.
fn build_playlists_list(app_state: &tauri::State<'_, crate::AppState>) -> Vec<PlaylistResponse> {
    let db_guard = app_state.db.lock().unwrap();
    if let Some(ref db) = *db_guard {
        if let Ok(all) = db.get_playlists() {
            return all.into_iter().map(|p| {
                let count = db.get_playlist_tracks(&p.id).map(|t| t.len() as i32).unwrap_or(0);
                PlaylistResponse {
                    id: p.id,
                    name: p.name,
                    track_count: count,
                    created_at: p.created_at,
                    updated_at: p.updated_at,
                }
            }).collect();
        }
    }
    Vec::new()
}

/// Build `TrackDetail` list for a specific playlist.
fn build_playlist_track_details(
    app_state: &tauri::State<'_, crate::AppState>,
    playlist_id: &str,
) -> Vec<super::routes::TrackDetail> {
    let db_guard = app_state.db.lock().unwrap();
    if let Some(ref db) = *db_guard {
        if let Ok(tracks) = db.get_playlist_tracks(playlist_id) {
            return tracks.into_iter().map(|t| track_to_detail(&t)).collect();
        }
    }
    Vec::new()
}

/// Convert a `TrackInfo` to a `TrackDetail`.
fn track_to_detail(t: &crate::audio::TrackInfo) -> super::routes::TrackDetail {
    super::routes::TrackDetail {
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
    }
}

// ─── Network helpers ─────────────────────────────────────────────────────────

/// Build `http://<ip>:<port>/stream/<encoded_path>`.
fn build_stream_url(state: &Arc<ServerState>, path: &str) -> String {
    let ip = determine_accessible_ip().unwrap_or_else(|| "127.0.0.1".to_string());
    let port = state.config.port;
    let encoded = urlencoding::encode(path);
    format!("http://{}:{}/stream/{}", ip, port, encoded)
}

/// Determine the best LAN IP address reachable by mobile clients.
fn determine_accessible_ip() -> Option<String> {
    use std::net::UdpSocket;

    // Method 1: UDP socket to Google DNS (finds the default-route IP)
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                let s = addr.ip().to_string();
                if !addr.ip().is_loopback() && !s.starts_with("169.254.") {
                    return Some(s);
                }
            }
        }
    }

    // Method 2: Enumerate interfaces
    if let Ok(ifaces) = if_addrs::get_if_addrs() {
        for iface in &ifaces {
            let addr = iface.addr.ip();
            if addr.is_ipv4() && !addr.is_loopback() {
                let s = addr.to_string();
                if !s.starts_with("169.254.") {
                    return Some(s);
                }
            }
        }
    }

    None
}

/// Get path and position of the currently-loaded track.
fn current_track_info(app_state: &tauri::State<'_, crate::AppState>) -> Option<(String, f64)> {
    app_state.player.lock().ok().and_then(|g| {
        g.as_ref().and_then(|p| {
            let s = p.get_status();
            s.track.map(|t| (t.path, s.position_secs))
        })
    })
}

// ─── Stats helpers ───────────────────────────────────────────────────────────

/// Finalize any active desktop stats session before switching to mobile.
async fn finalize_desktop_stats(
    app_state: &tauri::State<'_, crate::AppState>,
    state: &Arc<ServerState>,
) {
    if let Ok(mut tracker) = app_state.stats_tracker.lock() {
        let now_ms = crate::stats::current_time_ms();
        if let Some(event) = tracker.update_desktop(None, 0.0, false, now_ms) {
            let _ = crate::stats::record_stats_event(app_state, &state.app_handle, event);
            state.broadcast(ServerEvent::StatsUpdated { timestamp: now_ms });
            let _ = state.app_handle.emit("stats-updated", ());
        }
    }
}

// ─── Discord Rich Presence ───────────────────────────────────────────────────

/// Sync Discord Rich Presence with the current player state.
pub async fn sync_discord(
    _state: &Arc<ServerState>,
    app_state: &tauri::State<'_, crate::AppState>,
) {
    let status = {
        if let Ok(g) = app_state.player.lock() {
            if let Some(ref p) = *g { p.get_status() } else { return; }
        } else { return; }
    };

    if let Some(track) = status.track {
        let cover_url = app_state.current_cover_url.lock().unwrap().clone();

        if status.state == crate::audio::PlayerState::Playing {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
            let pos = status.position_secs as i64;
            let _ = app_state.discord.set_activity(
                &track.title, &track.artist,
                Some(now - pos), Some(now + (track.duration_secs as i64 - pos)),
                cover_url, Some(track.album),
            );
        } else {
            let _ = app_state.discord.set_activity(
                &format!("(Paused) {}", track.title), &track.artist,
                None, None, cover_url, Some(track.album),
            );
        }
    } else {
        let _ = app_state.discord.clear_activity();
    }
}
