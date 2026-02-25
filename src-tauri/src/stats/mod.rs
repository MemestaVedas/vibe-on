use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const MIN_SESSION_LISTEN_MS: i64 = 5_000;
const MAX_HISTORY_AGE_MS: i64 = 1000 * 60 * 60 * 24 * 365 * 2; // ~2 years

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

pub struct StatsStore {
    file_path: PathBuf,
    file_lock: Mutex<()>,
}

impl StatsStore {
    pub fn new(app_handle: &AppHandle) -> Result<Self, String> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {e}"))?;
        if !app_dir.exists() {
            fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create app dir: {e}"))?;
        }
        Ok(Self {
            file_path: app_dir.join("playback_events.json"),
            file_lock: Mutex::new(()),
        })
    }

    pub fn record_event(&self, event: PlaybackEvent) -> Result<(), String> {
        let _guard = self.file_lock.lock().map_err(|_| "Stats store lock poisoned".to_string())?;
        let mut events = self.read_events_locked()?;
        let cutoff = current_time_ms().saturating_sub(MAX_HISTORY_AGE_MS);
        events.retain(|e| e.timestamp >= cutoff);
        events.push(event);
        let serialized = serde_json::to_string(&events).map_err(|e| format!("Serialize stats failed: {e}"))?;
        fs::write(&self.file_path, serialized).map_err(|e| format!("Write stats failed: {e}"))?;
        Ok(())
    }

    pub fn load_events(&self) -> Result<Vec<PlaybackEvent>, String> {
        let _guard = self.file_lock.lock().map_err(|_| "Stats store lock poisoned".to_string())?;
        self.read_events_locked()
    }

    pub fn load_events_in_range(
        &self,
        start_ms: Option<i64>,
        end_ms: Option<i64>,
    ) -> Result<Vec<PlaybackEvent>, String> {
        let events = self.load_events()?;
        let start = start_ms.unwrap_or(i64::MIN);
        let end = end_ms.unwrap_or(i64::MAX);
        Ok(events
            .into_iter()
            .filter(|e| e.timestamp >= start && e.timestamp <= end)
            .collect())
    }

    fn read_events_locked(&self) -> Result<Vec<PlaybackEvent>, String> {
        if !self.file_path.exists() {
            return Ok(Vec::new());
        }
        let raw = fs::read_to_string(&self.file_path).map_err(|e| format!("Read stats failed: {e}"))?;
        if raw.trim().is_empty() {
            return Ok(Vec::new());
        }
        serde_json::from_str::<Vec<PlaybackEvent>>(&raw)
            .map_err(|e| format!("Parse stats failed: {e}"))
    }
}

pub fn ensure_stats_store(
    app_state: &crate::AppState,
    app_handle: &AppHandle,
) -> Result<(), String> {
    let mut guard = app_state.stats_store.lock().map_err(|_| "Stats store lock poisoned".to_string())?;
    if guard.is_none() {
        *guard = Some(StatsStore::new(app_handle)?);
    }
    Ok(())
}

pub fn record_stats_event(
    app_state: &crate::AppState,
    app_handle: &AppHandle,
    event: PlaybackEvent,
) -> Result<(), String> {
    ensure_stats_store(app_state, app_handle)?;
    let guard = app_state.stats_store.lock().map_err(|_| "Stats store lock poisoned".to_string())?;
    if let Some(ref store) = *guard {
        store.record_event(event)?;
    }
    Ok(())
}

pub fn load_stats_events(
    app_state: &crate::AppState,
    app_handle: &AppHandle,
    start_ms: Option<i64>,
    end_ms: Option<i64>,
) -> Result<Vec<PlaybackEvent>, String> {
    ensure_stats_store(app_state, app_handle)?;
    let guard = app_state.stats_store.lock().map_err(|_| "Stats store lock poisoned".to_string())?;
    if let Some(ref store) = *guard {
        return store.load_events_in_range(start_ms, end_ms);
    }
    Ok(Vec::new())
}

pub fn current_time_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
