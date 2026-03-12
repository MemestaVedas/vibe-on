use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

const MIN_SESSION_LISTEN_MS: i64 = 5_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackEvent {
    pub song_id: String,
    pub timestamp: i64,
    pub duration_ms: i64,
    pub start_timestamp: Option<i64>,
    pub end_timestamp: Option<i64>,
    pub output: String,
}

/// Aggregated analytics for a single track.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackAnalytics {
    pub song_id: String,
    pub play_count: i64,
    pub total_listen_ms: i64,
    pub last_played_ms: i64,
    pub avg_listen_pct: f64,
}

#[derive(Default)]
pub struct StatsTracker {
    desktop_session: Option<PlaybackSession>,
    mobile_session: Option<PlaybackSession>,
}

#[derive(Debug, Clone)]
struct PlaybackSession {
    song_id: String,
    output: String,
    last_position_secs: f64,
    last_update_ms: i64,
    accumulated_ms: i64,
    is_playing: bool,
}

impl StatsTracker {
    pub fn update_desktop(
        &mut self,
        song_id: Option<String>,
        position_secs: f64,
        is_playing: bool,
        now_ms: i64,
    ) -> Option<PlaybackEvent> {
        Self::update_session(
            &mut self.desktop_session,
            song_id,
            position_secs,
            is_playing,
            now_ms,
            "desktop",
        )
    }

    pub fn update_mobile_position(
        &mut self,
        song_id: Option<String>,
        position_secs: f64,
        now_ms: i64,
    ) -> Option<PlaybackEvent> {
        Self::update_session(
            &mut self.mobile_session,
            song_id,
            position_secs,
            true,
            now_ms,
            "mobile",
        )
    }

    pub fn stop_mobile(&mut self, now_ms: i64) -> Option<PlaybackEvent> {
        Self::finalize_session(&mut self.mobile_session, now_ms)
    }

    fn update_session(
        slot: &mut Option<PlaybackSession>,
        song_id: Option<String>,
        position_secs: f64,
        is_playing: bool,
        now_ms: i64,
        output: &str,
    ) -> Option<PlaybackEvent> {
        match (slot.as_mut(), song_id) {
            (Some(existing), Some(current_song_id)) if existing.song_id == current_song_id => {
                if existing.is_playing && is_playing {
                    let delta_secs = (position_secs - existing.last_position_secs).max(0.0);
                    existing.accumulated_ms += (delta_secs * 1000.0) as i64;
                }
                existing.last_position_secs = position_secs;
                existing.last_update_ms = now_ms;
                existing.is_playing = is_playing;
                None
            }
            (Some(_), Some(new_song_id)) => {
                let finalized = Self::finalize_session(slot, now_ms);
                *slot = Some(PlaybackSession {
                    song_id: new_song_id,
                    output: output.to_string(),
                    last_position_secs: position_secs,
                    last_update_ms: now_ms,
                    accumulated_ms: 0,
                    is_playing,
                });
                finalized
            }
            (Some(_), None) => Self::finalize_session(slot, now_ms),
            (None, Some(new_song_id)) => {
                *slot = Some(PlaybackSession {
                    song_id: new_song_id,
                    output: output.to_string(),
                    last_position_secs: position_secs,
                    last_update_ms: now_ms,
                    accumulated_ms: 0,
                    is_playing,
                });
                None
            }
            (None, None) => None,
        }
    }

    fn finalize_session(
        slot: &mut Option<PlaybackSession>,
        now_ms: i64,
    ) -> Option<PlaybackEvent> {
        let session = slot.take()?;
        let duration_ms = session.accumulated_ms.max(0);
        if duration_ms < MIN_SESSION_LISTEN_MS {
            return None;
        }
        let end_ts = now_ms.max(session.last_update_ms).max(0);
        let start_ts = (end_ts - duration_ms).max(0);
        Some(PlaybackEvent {
            song_id: session.song_id,
            timestamp: end_ts,
            duration_ms,
            start_timestamp: Some(start_ts),
            end_timestamp: Some(end_ts),
            output: session.output,
        })
    }
}

// ---------------------------------------------------------------------------
// Database-backed recording & querying
// ---------------------------------------------------------------------------

/// Record a playback event into SQLite via the app's DatabaseManager.
pub fn record_stats_event(
    app_state: &crate::AppState,
    event: PlaybackEvent,
) -> Result<(), String> {
    let guard = app_state.db.lock().map_err(|_| "db lock poisoned".to_string())?;
    let db = guard.as_ref().ok_or("database not initialized")?;
    db.insert_playback_event(&event)
}

/// Load playback events from SQLite, optionally filtered by time range.
pub fn load_stats_events(
    app_state: &crate::AppState,
    start_ms: Option<i64>,
    end_ms: Option<i64>,
) -> Result<Vec<PlaybackEvent>, String> {
    let guard = app_state.db.lock().map_err(|_| "db lock poisoned".to_string())?;
    let db = guard.as_ref().ok_or("database not initialized")?;
    db.load_playback_events(start_ms, end_ms)
}

/// Get aggregated analytics for the top-N most-played tracks.
pub fn get_top_tracks(
    app_state: &crate::AppState,
    limit: usize,
) -> Result<Vec<TrackAnalytics>, String> {
    let guard = app_state.db.lock().map_err(|_| "db lock poisoned".to_string())?;
    let db = guard.as_ref().ok_or("database not initialized")?;
    db.get_top_tracks(limit)
}

/// Get the most recently played tracks (unique, latest timestamp).
pub fn get_recently_played(
    app_state: &crate::AppState,
    limit: usize,
) -> Result<Vec<PlaybackEvent>, String> {
    let guard = app_state.db.lock().map_err(|_| "db lock poisoned".to_string())?;
    let db = guard.as_ref().ok_or("database not initialized")?;
    db.get_recently_played(limit)
}

/// Migrate legacy JSON playback_events.json into SQLite (idempotent).
pub fn migrate_json_to_sqlite(
    app_state: &crate::AppState,
    app_handle: &tauri::AppHandle,
) -> Result<usize, String> {
    use std::fs;
    use tauri::Manager;

    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir: {e}"))?;
    let json_path = app_dir.join("playback_events.json");
    if !json_path.exists() {
        return Ok(0);
    }
    let raw = fs::read_to_string(&json_path).map_err(|e| format!("read json: {e}"))?;
    if raw.trim().is_empty() {
        return Ok(0);
    }
    let events: Vec<PlaybackEvent> =
        serde_json::from_str(&raw).map_err(|e| format!("parse json: {e}"))?;
    let count = events.len();
    for ev in events {
        record_stats_event(app_state, ev)?;
    }
    // Rename so we don't re-migrate
    let backup = app_dir.join("playback_events.json.migrated");
    let _ = fs::rename(&json_path, backup);
    Ok(count)
}

pub fn current_time_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
