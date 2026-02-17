use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use super::schema::init_db;
use crate::audio::{TrackInfo, UnreleasedTrack};

pub struct DbAlbum {
    pub name: String,
    pub artist: String,
    pub cover_image_path: Option<String>,
    pub track_count: usize,
}

pub struct DbArtist {
    pub name: String,
    pub album_count: usize,
    pub track_count: usize,
}

pub struct DatabaseManager {
    conn: Arc<Mutex<Connection>>,
    covers_dir: PathBuf,
}

impl DatabaseManager {
    pub fn new(app_handle: &AppHandle) -> Result<Self> {
        let app_dir = app_handle.path().app_data_dir().unwrap();
        if !app_dir.exists() {
            std::fs::create_dir_all(&app_dir).unwrap();
        }
        let db_path = app_dir.join("library.db");
        let covers_dir = app_dir.join("covers");

        if !covers_dir.exists() {
            std::fs::create_dir_all(&covers_dir).unwrap();
        }

        let conn = Connection::open(db_path)?;

        // Initialize schema
        init_db(&conn)?;

        // Migration: Add new columns if missing
        let _ = conn.execute("ALTER TABLE tracks ADD COLUMN disc_number INTEGER", []);
        let _ = conn.execute("ALTER TABLE tracks ADD COLUMN track_number INTEGER", []);

        // Migration: Add Romaji and English columns
        let _ = conn.execute("ALTER TABLE tracks ADD COLUMN title_romaji TEXT", []);
        let _ = conn.execute("ALTER TABLE tracks ADD COLUMN title_en TEXT", []);
        let _ = conn.execute("ALTER TABLE tracks ADD COLUMN artist_romaji TEXT", []);
        let _ = conn.execute("ALTER TABLE tracks ADD COLUMN artist_en TEXT", []);
        let _ = conn.execute("ALTER TABLE tracks ADD COLUMN album_romaji TEXT", []);
        let _ = conn.execute("ALTER TABLE tracks ADD COLUMN album_en TEXT", []);

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            covers_dir,
        })
    }

    pub fn insert_track(&self, track: &TrackInfo, cover_data: Option<&[u8]>) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // Generate Romaji if needed
        let title_romaji = if crate::lyrics_transliteration::has_japanese(&track.title) {
            Some(crate::lyrics_transliteration::to_romaji(&track.title))
        } else {
            Some("".to_string())
        };

        let artist_romaji = if crate::lyrics_transliteration::has_japanese(&track.artist) {
            Some(crate::lyrics_transliteration::to_romaji(&track.artist))
        } else {
            Some("".to_string())
        };

        let album_romaji = if crate::lyrics_transliteration::has_japanese(&track.album) {
            Some(crate::lyrics_transliteration::to_romaji(&track.album))
        } else {
            Some("".to_string())
        };

        // Insert into tracks
        conn.execute(
            "INSERT OR REPLACE INTO tracks (
                path, title, artist, album, duration_secs, disc_number, track_number,
                title_romaji, artist_romaji, album_romaji
            ) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                track.path,
                track.title,
                track.artist,
                track.album,
                track.duration_secs,
                track.disc_number,
                track.track_number,
                title_romaji,
                artist_romaji,
                album_romaji
            ],
        )?;

        // Check if album exists and get current cover path
        let album_row: Option<Option<String>> = conn
            .query_row(
                "SELECT cover_image_path FROM albums WHERE name = ?1 AND artist = ?2",
                params![track.album, track.artist],
                |row| row.get(0),
            )
            .optional()?;

        let album_exists = album_row.is_some();
        let existing_cover = album_row.flatten();

        if let Some(data) = cover_data {
            if existing_cover.is_none() {
                let filename = format!("{}.jpg", Uuid::new_v4());
                let path = self.covers_dir.join(&filename);

                let saved = if let Ok(mut file) = fs::File::create(&path) {
                    file.write_all(data).is_ok()
                } else {
                    false
                };

                if saved {
                    if album_exists {
                        conn.execute(
                            "UPDATE albums SET cover_image_path = ?1 WHERE name = ?2 AND artist = ?3",
                            params![filename, track.album, track.artist],
                        )?;
                    } else {
                        conn.execute(
                            "INSERT INTO albums (name, artist, cover_image_path) VALUES (?1, ?2, ?3)",
                            params![track.album, track.artist, filename],
                        )?;
                    }
                } else if !album_exists {
                    // Create album entry even if save failed
                    conn.execute(
                        "INSERT INTO albums (name, artist, cover_image_path) VALUES (?1, ?2, ?3)",
                        params![track.album, track.artist, Option::<String>::None],
                    )?;
                }
            } else if !album_exists {
                // No cover data, just insert album
                conn.execute(
                    "INSERT INTO albums (name, artist, cover_image_path) VALUES (?1, ?2, ?3)",
                    params![track.album, track.artist, Option::<String>::None],
                )?;
            }
        } else if !album_exists {
            // No cover data and album doesn't exist
            conn.execute(
                "INSERT INTO albums (name, artist, cover_image_path) VALUES (?1, ?2, ?3)",
                params![track.album, track.artist, Option::<String>::None],
            )?;
        }

        Ok(())
    }

    pub fn update_album_cover(
        &self,
        album: &str,
        artist: &str,
        cover_filename: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE albums SET cover_image_path = ?1 WHERE name = ?2 AND artist = ?3",
            params![cover_filename, album, artist],
        )?;
        Ok(())
    }

    pub fn get_tracks_paginated(&self, limit: usize, offset: usize) -> Result<Vec<TrackInfo>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT t.path, t.title, t.artist, t.album, t.duration_secs, a.cover_image_path, t.disc_number, t.track_number,
             t.title_romaji, t.title_en, t.artist_romaji, t.artist_en, t.album_romaji, t.album_en
             FROM tracks t 
             LEFT JOIN albums a ON t.album = a.name AND t.artist = a.artist
             ORDER BY t.artist, t.album, t.disc_number, t.track_number, t.title
             LIMIT ?1 OFFSET ?2",
        )?;

        let track_iter = stmt.query_map(params![limit, offset], |row| {
            let cover_filename: Option<String> = row.get(5)?;
            Ok(TrackInfo {
                path: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                duration_secs: row.get(4)?,
                cover_image: cover_filename,
                disc_number: row.get(6).unwrap_or(None),
                track_number: row.get(7).unwrap_or(None),
                title_romaji: row.get(8).unwrap_or(None),
                title_en: row.get(9).unwrap_or(None),
                artist_romaji: row.get(10).unwrap_or(None),
                artist_en: row.get(11).unwrap_or(None),
                album_romaji: row.get(12).unwrap_or(None),
                album_en: row.get(13).unwrap_or(None),
                playlist_track_id: None,
            })
        })?;

        let mut tracks = Vec::new();
        for track in track_iter {
            tracks.push(track?);
        }

        Ok(tracks)
    }

    pub fn search_tracks(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<TrackInfo>> {
        let conn = self.conn.lock().unwrap();
        let search_query = format!("%{}%", query);

        let mut stmt = conn.prepare(
            "SELECT t.path, t.title, t.artist, t.album, t.duration_secs, a.cover_image_path, t.disc_number, t.track_number,
             t.title_romaji, t.title_en, t.artist_romaji, t.artist_en, t.album_romaji, t.album_en
             FROM tracks t 
             LEFT JOIN albums a ON t.album = a.name AND t.artist = a.artist
             WHERE t.title LIKE ?1 OR t.artist LIKE ?1 OR t.album LIKE ?1
                OR t.title_romaji LIKE ?1 OR t.artist_romaji LIKE ?1 OR t.album_romaji LIKE ?1
                OR t.title_en LIKE ?1 OR t.artist_en LIKE ?1 OR t.album_en LIKE ?1
             ORDER BY t.artist, t.album, t.disc_number, t.track_number, t.title
             LIMIT ?2 OFFSET ?3",
        )?;

        let track_iter = stmt.query_map(params![search_query, limit, offset], |row| {
            let cover_filename: Option<String> = row.get(5)?;
            Ok(TrackInfo {
                path: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                duration_secs: row.get(4)?,
                cover_image: cover_filename,
                disc_number: row.get(6).unwrap_or(None),
                track_number: row.get(7).unwrap_or(None),
                title_romaji: row.get(8).unwrap_or(None),
                title_en: row.get(9).unwrap_or(None),
                artist_romaji: row.get(10).unwrap_or(None),
                artist_en: row.get(11).unwrap_or(None),
                album_romaji: row.get(12).unwrap_or(None),
                album_en: row.get(13).unwrap_or(None),
                playlist_track_id: None,
            })
        })?;

        let mut tracks = Vec::new();
        for track in track_iter {
            tracks.push(track?);
        }

        Ok(tracks)
    }

    pub fn get_track(&self, path: &str) -> Result<Option<TrackInfo>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT t.path, t.title, t.artist, t.album, t.duration_secs, a.cover_image_path, t.disc_number, t.track_number,
             t.title_romaji, t.title_en, t.artist_romaji, t.artist_en, t.album_romaji, t.album_en
             FROM tracks t 
             LEFT JOIN albums a ON t.album = a.name AND t.artist = a.artist
             WHERE t.path = ?1",
        )?;

        let mut rows = stmt.query_map(params![path], |row| {
            let cover_filename: Option<String> = row.get(5)?;
            Ok(TrackInfo {
                path: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                duration_secs: row.get(4)?,
                cover_image: cover_filename,
                disc_number: row.get(6).unwrap_or(None),
                track_number: row.get(7).unwrap_or(None),
                title_romaji: row.get(8).unwrap_or(None),
                title_en: row.get(9).unwrap_or(None),
                artist_romaji: row.get(10).unwrap_or(None),
                artist_en: row.get(11).unwrap_or(None),
                album_romaji: row.get(12).unwrap_or(None),
                album_en: row.get(13).unwrap_or(None),
                playlist_track_id: None,
            })
        })?;

        if let Some(row) = rows.next() {
            Ok(Some(row?))
        } else {
            Ok(None)
        }
    }

    pub fn get_albums_paginated(
        &self,
        limit: usize,
        offset: usize,
    ) -> Result<(Vec<DbAlbum>, usize)> {
        let conn = self.conn.lock().unwrap();

        // Count total albums (approximate or separate query)
        // For distinct albums:
        let total: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM (SELECT DISTINCT name, artist FROM albums)",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let mut stmt = conn.prepare(
            "SELECT a.name, a.artist, a.cover_image_path, COUNT(t.path) as track_count
             FROM albums a
             LEFT JOIN tracks t ON t.album = a.name AND t.artist = a.artist
             GROUP BY a.name, a.artist
             ORDER BY a.name
             LIMIT ?1 OFFSET ?2",
        )?;

        let album_iter = stmt.query_map(params![limit, offset], |row| {
            let cover_filename: Option<String> = row.get(2)?;
            Ok(DbAlbum {
                name: row.get(0)?,
                artist: row.get(1)?,
                cover_image_path: cover_filename,
                track_count: row.get(3)?,
            })
        })?;

        let mut albums = Vec::new();
        for album in album_iter {
            albums.push(album?);
        }

        Ok((albums, total))
    }

    pub fn get_artists_paginated(
        &self,
        limit: usize,
        offset: usize,
    ) -> Result<(Vec<DbArtist>, usize)> {
        let conn = self.conn.lock().unwrap();

        // Count total artists
        let total: usize = conn
            .query_row("SELECT COUNT(DISTINCT artist) FROM tracks", [], |row| {
                row.get(0)
            })
            .unwrap_or(0);

        let mut stmt = conn.prepare(
            "SELECT artist, COUNT(DISTINCT album) as album_count, COUNT(path) as track_count
             FROM tracks
             GROUP BY artist
             ORDER BY artist
             LIMIT ?1 OFFSET ?2",
        )?;

        let artist_iter = stmt.query_map(params![limit, offset], |row| {
            Ok(DbArtist {
                name: row.get(0)?,
                album_count: row.get(1)?,
                track_count: row.get(2)?,
            })
        })?;

        let mut artists = Vec::new();
        for artist in artist_iter {
            artists.push(artist?);
        }

        Ok((artists, total))
    }

    // Search methods (omitted for brevity in this sprint if complexity is high, but let's try basic)
    // Actually, `search_library` in routes expects EVERYTHING at once (tracks, albums, artists) mixed.
    // If we paginated search, it gets complex.
    // Let's stick to get_albums/artists optimization first.

    pub fn search_library(&self, query: &str) -> Result<Vec<TrackInfo>> {
        let conn = self.conn.lock().unwrap();
        let search_query = format!("%{}%", query);

        let mut stmt = conn.prepare(
            "SELECT path, title, artist, album, duration_secs, disc_number, track_number,
             title_romaji, title_en, artist_romaji, artist_en, album_romaji, album_en
             FROM tracks 
             WHERE title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1
                OR title_romaji LIKE ?1 OR artist_romaji LIKE ?1 OR album_romaji LIKE ?1
                OR title_en LIKE ?1 OR artist_en LIKE ?1 OR album_en LIKE ?1
             ORDER BY artist, album, track_number",
        )?;

        let track_iter = stmt.query_map(params![search_query], |row| {
            Ok(TrackInfo {
                path: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                duration_secs: row.get(4)?,
                cover_image: None, // Loaded on demand
                disc_number: row.get(5)?,
                track_number: row.get(6)?,
                title_romaji: row.get(7).unwrap_or(None),
                title_en: row.get(8).unwrap_or(None),
                artist_romaji: row.get(9).unwrap_or(None),
                artist_en: row.get(10).unwrap_or(None),
                album_romaji: row.get(11).unwrap_or(None),
                album_en: row.get(12).unwrap_or(None),
                playlist_track_id: None,
            })
        })?;

        let mut tracks = Vec::new();
        for track in track_iter {
            tracks.push(track?);
        }

        Ok(tracks)
    }

    pub fn get_all_tracks(&self) -> Result<Vec<TrackInfo>> {
        let conn = self.conn.lock().unwrap();

        // Join tracks with albums to get the cover image path
        let mut stmt = conn.prepare(
            "SELECT t.path, t.title, t.artist, t.album, t.duration_secs, a.cover_image_path, t.disc_number, t.track_number,
             t.title_romaji, t.title_en, t.artist_romaji, t.artist_en, t.album_romaji, t.album_en
             FROM tracks t 
             LEFT JOIN albums a ON t.album = a.name AND t.artist = a.artist
             ORDER BY t.artist, t.album, t.disc_number, t.track_number, t.title",
        )?;

        let track_iter = stmt.query_map([], |row| {
            let cover_filename: Option<String> = row.get(5)?;

            Ok(TrackInfo {
                path: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                duration_secs: row.get(4)?,
                cover_image: cover_filename,
                disc_number: row.get(6).unwrap_or(None),
                track_number: row.get(7).unwrap_or(None),
                title_romaji: row.get(8).unwrap_or(None),
                title_en: row.get(9).unwrap_or(None),
                artist_romaji: row.get(10).unwrap_or(None),
                artist_en: row.get(11).unwrap_or(None),
                album_romaji: row.get(12).unwrap_or(None),
                album_en: row.get(13).unwrap_or(None),
                playlist_track_id: None,
            })
        })?;

        let mut tracks = Vec::new();
        for track in track_iter {
            tracks.push(track?);
        }

        Ok(tracks)
    }

    pub fn get_all_track_paths(&self) -> Result<std::collections::HashSet<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT path FROM tracks")?;

        let path_iter = stmt.query_map([], |row| row.get::<_, String>(0))?;

        let mut paths = std::collections::HashSet::new();
        for path in path_iter {
            paths.insert(path?);
        }

        Ok(paths)
    }

    pub fn get_covers_dir(&self) -> PathBuf {
        self.covers_dir.clone()
    }

    // Unreleased Library Methods
    pub fn insert_unreleased_track(&self, track: &UnreleasedTrack) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO unreleased_tracks (video_id, title, artist, duration_secs, thumbnail_url, content_type)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                track.video_id,
                track.title,
                track.artist,
                track.duration_secs,
                track.thumbnail_url,
                track.content_type
            ],
        )?;
        Ok(())
    }

    pub fn delete_unreleased_track(&self, video_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM unreleased_tracks WHERE video_id = ?1",
            params![video_id],
        )?;
        Ok(())
    }

    pub fn get_unreleased_tracks(&self) -> Result<Vec<UnreleasedTrack>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT video_id, title, artist, duration_secs, thumbnail_url, content_type, added_at
             FROM unreleased_tracks
             ORDER BY added_at DESC",
        )?;

        let track_iter = stmt.query_map([], |row| {
            // Parse added_at if needed, but we keep it as timestamp/string?
            // schema says TIMESTAMP DEFAULT CURRENT_TIMESTAMP which is usually text in sqlite unless configured
            // Let's assume we don't strictly need precise added_at for now or just grab it
            let added_at_str: Option<String> = row.get(6).ok();
            // Simple conversion or ignore
            let added_at = if let Some(_s) = added_at_str {
                // parse or just use 0
                Some(0)
            } else {
                None
            };

            Ok(UnreleasedTrack {
                video_id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2).unwrap_or("Unknown".to_string()),
                duration_secs: row.get(3)?,
                thumbnail_url: row.get(4).ok(),
                content_type: row.get(5)?,
                channel_name: None, // Not stored currently
                view_count: None,
                added_at: added_at,
                // album field doesn't exist in unreleased track struct? Wait, UnreleasedTrack extends TrackInfo in frontend but in Rust it is separate struct
                // Rust struct above:
                // pub video_id: String,
                // pub title: String,
                // pub artist: String,
                // pub duration_secs: f64,
                // pub thumbnail_url: Option<String>,
                // pub content_type: String, ...
            })
        })?;

        let mut tracks = Vec::new();
        for track in track_iter {
            tracks.push(track?);
        }
        Ok(tracks)
    }

    pub fn remove_folder(&self, path: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        // Delete all tracks where path starts with the folder path
        // We ensure path ends with separator to avoid partial matches on similar folder names
        // But users might pass path without separator.
        // Let's rely on LIKE 'path%' but maybe be careful.
        // Actually, tracks.path is absolute. folder path is absolute.
        // Ideally we should normalize separators.
        // For simple usage: LIKE ? || '%'
        conn.execute(
            "DELETE FROM tracks WHERE path LIKE ?1 || '%'",
            params![path],
        )?;
        Ok(())
    }

    pub fn clear_all_data(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        println!("[Database] Clearing all data...");

        // Delete all tracks, albums, and unreleased tracks
        conn.execute("DELETE FROM tracks", [])?;
        conn.execute("DELETE FROM albums", [])?;
        conn.execute("DELETE FROM unreleased_tracks", [])?;
        println!("[Database] Tables cleared.");

        // Optimize DB file
        conn.execute("VACUUM", [])?;
        println!("[Database] VACUUM complete.");

        // Release lock before file operations
        drop(conn);

        // Clear all cover images from disk
        if self.covers_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&self.covers_dir) {
                let mut count = 0;
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if std::fs::remove_file(path).is_ok() {
                            count += 1;
                        }
                    }
                }
                println!("[Database] Removed {} cover files.", count);
            }
        }

        Ok(())
    }

    pub fn get_tracks_missing_metadata(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        // Check all tracks where romaji is NULL.
        let mut stmt = conn.prepare("SELECT path FROM tracks WHERE title_romaji IS NULL")?;

        let paths_iter = stmt.query_map([], |row| row.get(0))?;

        let mut paths = Vec::new();
        for path in paths_iter {
            paths.push(path?);
        }
        Ok(paths)
    }

    // Playlist Methods

    pub fn create_playlist(&self, name: &str) -> Result<String> {
        let conn = self.conn.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO playlists (id, name) VALUES (?1, ?2)",
            params![id, name],
        )?;
        Ok(id)
    }

    pub fn delete_playlist(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn rename_playlist(&self, id: &str, new_name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE playlists SET name = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![new_name, id],
        )?;
        Ok(())
    }

    pub fn get_playlists(&self) -> Result<Vec<DbPlaylist>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT id, name, created_at, updated_at FROM playlists ORDER BY name")?;

        let playlist_iter = stmt.query_map([], |row| {
            // Handle timestamps as strings for now, or use chrono if added later
            let created_at: String = row.get(2).unwrap_or_default();
            let updated_at: String = row.get(3).unwrap_or_default();

            Ok(DbPlaylist {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at,
                updated_at,
            })
        })?;

        let mut playlists = Vec::new();
        for playlist in playlist_iter {
            playlists.push(playlist?);
        }
        Ok(playlists)
    }

    pub fn add_track_to_playlist(&self, playlist_id: &str, track_path: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        // Get current max position
        let max_pos: Option<i32> = conn
            .query_row(
                "SELECT MAX(position) FROM playlist_tracks WHERE playlist_id = ?1",
                params![playlist_id],
                |row| row.get(0),
            )
            .unwrap_or(None);

        let new_pos = max_pos.unwrap_or(-1) + 1;

        conn.execute(
            "INSERT INTO playlist_tracks (playlist_id, track_path, position) VALUES (?1, ?2, ?3)",
            params![playlist_id, track_path, new_pos],
        )?;
        // Update playlist timestamp
        conn.execute(
            "UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![playlist_id],
        )?;
        Ok(())
    }

    pub fn remove_track_from_playlist(
        &self,
        playlist_id: &str,
        playlist_track_id: i64,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM playlist_tracks WHERE id = ?1 AND playlist_id = ?2",
            params![playlist_track_id, playlist_id],
        )?;
        // Update playlist timestamp
        conn.execute(
            "UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![playlist_id],
        )?;
        Ok(())
    }

    // Simple reorder: just update position of one item (swap logic might be needed in frontend or complex here)
    // Actually, simple way is to delete and re-insert or update one.
    // Better: update position. But dealing with shifting other items is tricky in simple SQL without a transaction block handling it.
    // For MVP: Let's assume we might implement full reorder later or just update position if we trust frontend sending right values.
    // Let's implement a swap or simple update.
    pub fn reorder_playlist_track(
        &self,
        _playlist_id: &str,
        playlist_track_id: i64,
        new_position: i32,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        // This is naive and might cause duplicates positions, but fine for MVP v1
        conn.execute(
            "UPDATE playlist_tracks SET position = ?1 WHERE id = ?2",
            params![new_position, playlist_track_id],
        )?;
        Ok(())
    }

    pub fn get_playlist_tracks(&self, playlist_id: &str) -> Result<Vec<TrackInfo>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT t.path, t.title, t.artist, t.album, t.duration_secs, a.cover_image_path, t.disc_number, t.track_number,
             t.title_romaji, t.title_en, t.artist_romaji, t.artist_en, t.album_romaji, t.album_en, pt.id as playlist_track_id
             FROM playlist_tracks pt
             LEFT JOIN tracks t ON pt.track_path = t.path
             LEFT JOIN albums a ON t.album = a.name AND t.artist = a.artist
             WHERE pt.playlist_id = ?1
             ORDER BY pt.position"
        )?;

        let track_iter = stmt.query_map(params![playlist_id], |row| {
            let cover_filename: Option<String> = row.get(5)?;
            // check if track exists (t.path not null). If null, maybe file deleted but still in playlist.
            // Row.get(0) will fail if null? No, Option<String> works.
            let path: Option<String> = row.get(0).ok();

            if let Some(p) = path {
                Ok(TrackInfo {
                    path: p,
                    title: row.get(1)?,
                    artist: row.get(2)?,
                    album: row.get(3)?,
                    duration_secs: row.get(4)?,
                    cover_image: cover_filename,
                    disc_number: row.get(6).unwrap_or(None),
                    track_number: row.get(7).unwrap_or(None),
                    title_romaji: row.get(8).unwrap_or(None),
                    title_en: row.get(9).unwrap_or(None),
                    artist_romaji: row.get(10).unwrap_or(None),
                    artist_en: row.get(11).unwrap_or(None),
                    album_romaji: row.get(12).unwrap_or(None),
                    album_en: row.get(13).unwrap_or(None),
                    playlist_track_id: Some(row.get(14)?),
                })
            } else {
                // Return dummy or empty track for missing file?
                // Or error out?
                // Let's return a special 'Missing' track info or just valid struct with 'Unknown'
                Ok(TrackInfo {
                    path: "MISSING".to_string(),
                    title: "Unknown Track".to_string(),
                    artist: "Unknown".to_string(),
                    album: "Unknown".to_string(),
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
                    playlist_track_id: Some(row.get(14)?),
                })
            }
        })?;

        let mut tracks = Vec::new();
        for track in track_iter {
            let t = track?;
            if t.path != "MISSING" {
                tracks.push(t);
            }
        }
        Ok(tracks)
    }
}

#[derive(Serialize)]
pub struct DbPlaylist {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct DbPlaylistTrack {
    pub id: i64,
    pub playlist_id: String,
    pub track_path: String,
    pub position: i32,
    pub added_at: String,
}
