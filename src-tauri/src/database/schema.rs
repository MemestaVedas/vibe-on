use rusqlite::{Connection, Result};

pub const DB_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT NOT NULL,
    duration_secs REAL NOT NULL,
    disc_number INTEGER,
    track_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    artist TEXT NOT NULL,
    cover_image_path TEXT,
    main_color INTEGER,
    UNIQUE(name, artist)
);

CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);



CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    customization_type TEXT NOT NULL DEFAULT 'default',
    cover_color INTEGER,
    cover_icon TEXT,
    cover_image_uri TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id TEXT NOT NULL,
    track_path TEXT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    position INTEGER NOT NULL,
    FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(position);

CREATE TABLE IF NOT EXISTS playback_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    start_ms INTEGER,
    end_ms INTEGER,
    output TEXT NOT NULL DEFAULT 'desktop',
    UNIQUE(song_id, timestamp_ms, duration_ms)
);

CREATE INDEX IF NOT EXISTS idx_playback_events_song ON playback_events(song_id);
CREATE INDEX IF NOT EXISTS idx_playback_events_ts ON playback_events(timestamp_ms);
"#;

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(DB_SCHEMA)
}
