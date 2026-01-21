use serde::{Deserialize, Serialize};

/// Current state of the audio player
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlayerState {
    Stopped,
    Playing,
    Paused,
}

impl Default for PlayerState {
    fn default() -> Self {
        Self::Stopped
    }
}

/// Information about the currently playing track
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackInfo {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: f64,
    pub cover_image: Option<String>,
}

impl Default for TrackInfo {
    fn default() -> Self {
        Self {
            path: String::new(),
            title: String::from("Unknown"),
            artist: String::from("Unknown Artist"),
            album: String::from("Unknown Album"),
            duration_secs: 0.0,
            cover_image: None,
        }
    }
}

/// Complete player status for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerStatus {
    pub state: PlayerState,
    pub track: Option<TrackInfo>,
    pub position_secs: f64,
    pub volume: f32,
}

impl Default for PlayerStatus {
    fn default() -> Self {
        Self {
            state: PlayerState::Stopped,
            track: None,
            position_secs: 0.0,
            volume: 1.0,
        }
    }
}
