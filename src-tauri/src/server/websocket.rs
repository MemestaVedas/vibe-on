//! WebSocket handler for real-time control

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

use super::{ConnectedClient, ServerEvent, ServerState};

/// Client to server messages
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientMessage {
    /// Initial handshake
    Hello { client_name: String },
    /// Request current status
    GetStatus,
    /// Playback controls
    Play,
    Pause,
    Resume,
    Stop,
    Next,
    Previous,
    /// Seek to position
    Seek { position_secs: f64 },
    /// Set volume (0.0 - 1.0)
    SetVolume { volume: f64 },
    /// Toggle shuffle
    ToggleShuffle,
    /// Cycle repeat mode
    CycleRepeat,
    /// Play a specific track
    PlayTrack { path: String },
    /// Play an album
    PlayAlbum { album: String, artist: String },
    /// Play an artist
    PlayArtist { artist: String },
    /// Add track to queue
    AddToQueue { path: String },
    /// Set entire queue
    SetQueue { paths: Vec<String> },
    /// Toggle favorite
    ToggleFavorite { path: String },
    /// Get lyrics
    GetLyrics,
    /// Request audio streaming to mobile
    RequestStreamToMobile,
    /// Stop streaming to mobile
    StopStreamToMobile,
    /// Mobile is ready to receive stream
    HandoffReady,
    /// Network stats from mobile
    NetworkStats { buffer_ms: u32, throughput_kbps: u32 },
    /// WebRTC signaling: offer
    WebrtcOffer { target_peer_id: String, sdp: String },
    /// WebRTC signaling: answer
    WebrtcAnswer { target_peer_id: String, sdp: String },
    /// WebRTC signaling: ICE candidate
    IceCandidate { target_peer_id: String, candidate: String },
    /// Ping for keepalive
    Ping,
}

/// Server to client messages
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerMessage {
    /// Welcome message after hello
    Welcome {
        client_id: String,
        server_name: String,
        version: String,
    },
    /// Current media session state
    #[serde(rename_all = "camelCase")]
    MediaSession {
        track_id: String,
        title: String,
        artist: String,
        album: String,
        duration: f64,
        cover_url: Option<String>,
        is_playing: bool,
        position: f64,
        timestamp: u64,
    },
    /// Player status
    #[serde(rename_all = "camelCase")]
    Status {
        volume: f64,
        shuffle: bool,
        repeat_mode: String,
        output: String,
    },
    /// Position update
    #[serde(rename_all = "camelCase")]
    PositionUpdate {
        position: f64,
        timestamp: u64,
    },
    /// Lyrics data
    #[serde(rename_all = "camelCase")]
    Lyrics {
        track_path: String,
        has_synced: bool,
        synced_lyrics: Option<String>,
        plain_lyrics: Option<String>,
        instrumental: bool,
    },
    /// Prepare for audio handoff
    #[serde(rename_all = "camelCase")]
    HandoffPrepare {
        sample: u64,
        url: String,
    },
    /// Commit handoff (start playing)
    HandoffCommit,
    /// Stream stopped
    StreamStopped,
    /// Queue update
    #[serde(rename_all = "camelCase")]
    QueueUpdate {
        tracks: Vec<super::TrackSummary>,
    },
    /// WebRTC signaling relay
    #[serde(rename_all = "camelCase")]
    WebrtcOffer {
        from_peer_id: String,
        sdp: String,
    },
    /// WebRTC answer relay
    #[serde(rename_all = "camelCase")]
    WebrtcAnswer {
        from_peer_id: String,
        sdp: String,
    },
    /// ICE candidate relay
    #[serde(rename_all = "camelCase")]
    IceCandidate {
        from_peer_id: String,
        candidate: String,
    },
    /// Error message
    Error { message: String },
    /// Pong response
    Pong,
}

impl From<ServerEvent> for ServerMessage {
    fn from(event: ServerEvent) -> Self {
        match event {
            ServerEvent::MediaSession {
                track_id, title, artist, album, duration, cover_url, is_playing, position, timestamp
            } => ServerMessage::MediaSession {
                track_id, title, artist, album, duration, cover_url, is_playing, position, timestamp
            },
            ServerEvent::PositionUpdate { position, timestamp } => {
                ServerMessage::PositionUpdate { position, timestamp }
            }
            ServerEvent::Status { volume, shuffle, repeat_mode, output } => {
                ServerMessage::Status { volume, shuffle, repeat_mode, output }
            }
            ServerEvent::QueueUpdate { tracks } => {
                ServerMessage::QueueUpdate { tracks }
            }
            ServerEvent::Lyrics { track_path, has_synced, synced_lyrics, plain_lyrics, instrumental } => {
                ServerMessage::Lyrics { track_path, has_synced, synced_lyrics, plain_lyrics, instrumental }
            }
            ServerEvent::HandoffPrepare { sample, url } => {
                ServerMessage::HandoffPrepare { sample, url }
            }
            ServerEvent::HandoffCommit => ServerMessage::HandoffCommit,
            ServerEvent::StreamStopped => ServerMessage::StreamStopped,
            ServerEvent::Error { message } => ServerMessage::Error { message },
            ServerEvent::Pong => ServerMessage::Pong,
        }
    }
}

/// WebSocket upgrade handler
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<ServerState>>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// Handle a WebSocket connection
async fn handle_socket(socket: WebSocket, state: Arc<ServerState>) {
    let (mut sender, mut receiver) = socket.split();
    
    // Subscribe to broadcast events
    let mut event_rx = state.event_tx.subscribe();
    
    // Generate client ID
    let client_id = uuid::Uuid::new_v4().to_string();
    let client_id_clone = client_id.clone();
    
    // Spawn task to forward events to client
    let send_task = tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            let msg: ServerMessage = event.into();
            let json = serde_json::to_string(&msg).unwrap();
            if sender.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
    });
    
    // Handle incoming messages
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(client_msg) => {
                        handle_client_message(&state, &client_id, client_msg).await;
                    }
                    Err(e) => {
                        log::warn!("Invalid WebSocket message: {}", e);
                        state.broadcast(ServerEvent::Error {
                            message: format!("Invalid message format: {}", e),
                        });
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
    
    // Cleanup
    send_task.abort();
    
    // Remove client from list
    let mut clients = state.clients.write().await;
    clients.retain(|c| c.id != client_id_clone);
}

/// Handle a client message
async fn handle_client_message(
    state: &Arc<ServerState>,
    client_id: &str,
    msg: ClientMessage,
) {
    match msg {
        ClientMessage::Hello { client_name } => {
            // Add client to list
            let client = ConnectedClient {
                id: client_id.to_string(),
                name: client_name,
                connected_at: std::time::Instant::now(),
            };
            state.clients.write().await.push(client);
            
            // Send welcome
            let _welcome = ServerEvent::MediaSession {
                track_id: "".to_string(),
                title: "".to_string(),
                artist: "".to_string(),
                album: "".to_string(),
                duration: 0.0,
                cover_url: None,
                is_playing: false,
                position: 0.0,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
            };
            
            // Send current status
            send_current_status(state).await;
        }
        
        ClientMessage::GetStatus => {
            send_current_status(state).await;
        }
        
        ClientMessage::Play => {
            if let Ok(mut player_guard) = state.app_state.player.lock() {
                if let Some(ref mut player) = *player_guard {
                    player.resume();
                }
            }
            send_current_status(state).await;
        }
        
        ClientMessage::Pause | ClientMessage::Stop => {
            if let Ok(mut player_guard) = state.app_state.player.lock() {
                if let Some(ref mut player) = *player_guard {
                    player.pause();
                }
            }
            send_current_status(state).await;
        }
        
        ClientMessage::Resume => {
            if let Ok(mut player_guard) = state.app_state.player.lock() {
                if let Some(ref mut player) = *player_guard {
                    player.resume();
                }
            }
            send_current_status(state).await;
        }
        
        ClientMessage::Next => {
            // TODO: Implement queue navigation
            state.broadcast(ServerEvent::Error {
                message: "Next track not implemented yet".to_string(),
            });
        }
        
        ClientMessage::Previous => {
            // TODO: Implement queue navigation
            state.broadcast(ServerEvent::Error {
                message: "Previous track not implemented yet".to_string(),
            });
        }
        
        ClientMessage::Seek { position_secs } => {
            if let Ok(mut player_guard) = state.app_state.player.lock() {
                if let Some(ref mut player) = *player_guard {
                    player.seek(position_secs);
                }
            }
            send_current_status(state).await;
        }
        
        ClientMessage::SetVolume { volume } => {
            if let Ok(mut player_guard) = state.app_state.player.lock() {
                if let Some(ref mut player) = *player_guard {
                    player.set_volume(volume as f32);
                }
            }
            send_current_status(state).await;
        }
        
        ClientMessage::PlayTrack { path } => {
            if let Ok(mut player_guard) = state.app_state.player.lock() {
                if let Some(ref mut player) = *player_guard {
                    let _ = player.play_file(&path);
                }
            }
            send_current_status(state).await;
        }
        
        ClientMessage::RequestStreamToMobile => {
            // Get current position and prepare handoff
            let (sample, url) = {
                let player_guard = state.app_state.player.lock().ok();
                let position = player_guard
                    .as_ref()
                    .and_then(|p| p.as_ref())
                    .map(|p| p.get_status().position_secs)
                    .unwrap_or(0.0);
                
                // Calculate sample position (assuming 44.1kHz)
                let sample = (position * 44100.0) as u64;
                let url = format!("http://{}:{}/stream?start={}", 
                    local_ip().unwrap_or("127.0.0.1".to_string()),
                    state.config.port,
                    sample
                );
                (sample, url)
            };
            
            state.broadcast(ServerEvent::HandoffPrepare { sample, url });
        }
        
        ClientMessage::HandoffReady => {
            // Pause desktop playback and commit handoff
            if let Ok(mut player_guard) = state.app_state.player.lock() {
                if let Some(ref mut player) = *player_guard {
                    player.pause();
                }
            }
            state.broadcast(ServerEvent::HandoffCommit);
        }
        
        ClientMessage::StopStreamToMobile => {
            // Resume desktop playback
            if let Ok(mut player_guard) = state.app_state.player.lock() {
                if let Some(ref mut player) = *player_guard {
                    player.resume();
                }
            }
            state.broadcast(ServerEvent::StreamStopped);
        }
        
        ClientMessage::Ping => {
            state.broadcast(ServerEvent::Pong);
        }
        
        // TODO: Implement remaining messages
        _ => {
            log::debug!("Unhandled message type");
        }
    }
}

/// Send current playback status to all clients
async fn send_current_status(state: &Arc<ServerState>) {
    let (track_id, title, artist, album, duration, cover_url, is_playing, position, volume) = {
        if let Ok(player_guard) = state.app_state.player.lock() {
            if let Some(ref player) = *player_guard {
                let status = player.get_status();
                let is_playing = status.state == crate::audio::PlayerState::Playing;
                let position = status.position_secs;
                let volume = status.volume;
                
                if let Some(ref track) = status.track {
                    (
                        track.path.clone(),
                        track.title.clone(),
                        track.artist.clone(),
                        track.album.clone(),
                        track.duration_secs,
                        Some(format!("/cover/{}", urlencoding::encode(&track.path))),
                        is_playing,
                        position,
                        volume,
                    )
                } else {
                    ("".to_string(), "".to_string(), "".to_string(), "".to_string(), 0.0, None, false, 0.0, volume)
                }
            } else {
                ("".to_string(), "".to_string(), "".to_string(), "".to_string(), 0.0, None, false, 0.0, 1.0)
            }
        } else {
            ("".to_string(), "".to_string(), "".to_string(), "".to_string(), 0.0, None, false, 0.0, 1.0)
        }
    };
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    
    state.broadcast(ServerEvent::MediaSession {
        track_id,
        title,
        artist,
        album,
        duration,
        cover_url,
        is_playing,
        position,
        timestamp,
    });
    
    state.broadcast(ServerEvent::Status {
        volume: volume as f64,
        shuffle: false,
        repeat_mode: "off".to_string(),
        output: "desktop".to_string(),
    });
}

/// Get local IP address
fn local_ip() -> Option<String> {
    use std::net::UdpSocket;
    
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip().to_string())
}
