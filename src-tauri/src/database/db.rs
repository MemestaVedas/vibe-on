use rusqlite::{params, Connection, OptionalExtension, Result};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use super::schema::init_db;
use crate::audio::TrackInfo;

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

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            covers_dir,
        })
    }

    pub fn insert_track(&self, track: &TrackInfo, cover_data: Option<&[u8]>) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // Insert into tracks
        conn.execute(
            "INSERT OR REPLACE INTO tracks (path, title, artist, album, duration_secs) 
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                track.path,
                track.title,
                track.artist,
                track.album,
                track.duration_secs
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

        // If we have cover data and (album doesn't exist OR album has no cover), save it
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

    pub fn get_all_tracks(&self) -> Result<Vec<TrackInfo>> {
        let conn = self.conn.lock().unwrap();

        // Join tracks with albums to get the cover image path
        let mut stmt = conn.prepare(
            "SELECT t.path, t.title, t.artist, t.album, t.duration_secs, a.cover_image_path 
             FROM tracks t 
             LEFT JOIN albums a ON t.album = a.name AND t.artist = a.artist
             ORDER BY t.artist, t.album, t.title",
        )?;

        let track_iter = stmt.query_map([], |row| {
            let cover_filename: Option<String> = row.get(5)?;

            // Convert filename to full asset URL?
            // Actually, usually we send just the filename or a special protocol URL.
            // If we send just filename, frontend needs to know where to find it.
            // Or we can construct `https://asset.localhost/covers/filename` here.
            // But `asset.localhost` depends on Tauri config.
            // Let's return just the filename for now, and handle URL in frontend or helper.
            // Wait, `TrackInfo` expects `Option<String>`.

            Ok(TrackInfo {
                path: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                duration_secs: row.get(4)?,
                cover_image: cover_filename,
            })
        })?;

        let mut tracks = Vec::new();
        for track in track_iter {
            tracks.push(track?);
        }

        Ok(tracks)
    }

    pub fn get_covers_dir(&self) -> PathBuf {
        self.covers_dir.clone()
    }
}
