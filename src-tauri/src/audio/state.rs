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
    pub disc_number: Option<u32>,
    pub track_number: Option<u32>,
    pub title_romaji: Option<String>,
    pub title_en: Option<String>,
    pub artist_romaji: Option<String>,
    pub artist_en: Option<String>,
    pub album_romaji: Option<String>,
    pub album_en: Option<String>,
    pub playlist_track_id: Option<i64>,
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
            disc_number: None,
            track_number: None,
            title_romaji: None,
            title_en: None,
            artist_romaji: None,
            artist_en: None,
            album_romaji: None,
            album_en: None,
            playlist_track_id: None,
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
