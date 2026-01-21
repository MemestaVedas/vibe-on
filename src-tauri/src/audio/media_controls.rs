//! Windows System Media Transport Controls integration using souvlaki
//!
//! Service pattern: Spawns a dedicated thread to manage media controls.

use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, PlatformConfig};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug)]
pub enum MediaCmd {
    SetMetadata {
        title: String,
        artist: String,
        album: String,
    },
    SetPlaying,
    SetPaused,
    SetStopped,
    Shutdown,
}

pub struct MediaControlService;

impl MediaControlService {
    #[cfg(target_os = "windows")]
    pub fn start(app: AppHandle, hwnd: isize) -> Sender<MediaCmd> {
        let (tx, rx) = channel::<MediaCmd>();

        thread::spawn(move || {
            if let Err(e) = Self::run_loop(app, hwnd, rx) {
                eprintln!("[MediaControls] Thread error: {}", e);
            }
        });

        tx
    }

    #[cfg(not(target_os = "windows"))]
    pub fn start(_app: AppHandle, _hwnd: isize) -> Sender<MediaCmd> {
        let (tx, _) = channel::<MediaCmd>();
        tx
    }

    #[cfg(target_os = "windows")]
    fn run_loop(app: AppHandle, hwnd: isize, rx: Receiver<MediaCmd>) -> Result<(), String> {
        let hwnd_ptr = hwnd as *mut std::ffi::c_void;
        let config = PlatformConfig {
            dbus_name: "vibe_on",
            display_name: "VIBE-ON!",
            hwnd: if hwnd != 0 { Some(hwnd_ptr) } else { None },
        };

        let mut controls = MediaControls::new(config)
            .map_err(|e| format!("Failed to create media controls: {:?}", e))?;

        // Attach event handler
        // Note: souvlaki callbacks might come from a different thread (message loop)
        // We need to emit to Tauri. AppHandle is Send + Sync + Clone.
        let app_clone = app.clone();
        controls
            .attach(move |event: MediaControlEvent| {
                let event_name = match event {
                    MediaControlEvent::Play | MediaControlEvent::Toggle => "media:play",
                    MediaControlEvent::Pause => "media:pause",
                    MediaControlEvent::Next => "media:next",
                    MediaControlEvent::Previous => "media:prev",
                    MediaControlEvent::Stop => "media:stop",
                    _ => return,
                };

                // Emit event to frontend
                let _ = app_clone.emit(event_name, ());
            })
            .map_err(|e| format!("Failed to attach event handler: {:?}", e))?;

        // Loop handling commands
        loop {
            match rx.recv() {
                Ok(MediaCmd::SetMetadata {
                    title,
                    artist,
                    album,
                }) => {
                    let _ = controls.set_metadata(MediaMetadata {
                        title: Some(&title),
                        artist: Some(&artist),
                        album: Some(&album),
                        ..Default::default()
                    });
                }
                Ok(MediaCmd::SetPlaying) => {
                    let _ = controls.set_playback(MediaPlayback::Playing { progress: None });
                }
                Ok(MediaCmd::SetPaused) => {
                    let _ = controls.set_playback(MediaPlayback::Paused { progress: None });
                }
                Ok(MediaCmd::SetStopped) => {
                    let _ = controls.set_playback(MediaPlayback::Stopped);
                }
                Ok(MediaCmd::Shutdown) => break,
                Err(_) => break, // Channel closed
            }
        }
        Ok(())
    }
}
