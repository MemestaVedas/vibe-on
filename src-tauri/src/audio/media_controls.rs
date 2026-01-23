//! Windows System Media Transport Controls integration using souvlaki
//!
//! Service pattern: Spawns a dedicated thread to manage media controls.
//! Uses 'windows' crate for message pumping on the background thread.

use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, PlatformConfig};
use std::sync::mpsc::{channel, Receiver, Sender, TryRecvError};
use std::thread;
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "windows")]
use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    DispatchMessageW, PeekMessageW, TranslateMessage, MSG, PM_REMOVE, WM_QUIT,
};

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
    fn run_loop(app: AppHandle, _hwnd: isize, rx: Receiver<MediaCmd>) -> Result<(), String> {
        // Initialize COM as STA (Single Threaded Apartment) for this thread
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        }

        // Use internal window (hwnd: None) to ensure correct Identity/Display Name use
        // and avoid thread-ownership issues with the main window.
        let config = PlatformConfig {
            dbus_name: "vibe_on",
            display_name: "VIBE-ON!",
            hwnd: None,
        };

        let mut controls = MediaControls::new(config)
            .map_err(|e| format!("Failed to create media controls: {:?}", e))?;

        // Attach event handler
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

        // Loop handling commands AND pumping Windows messages
        loop {
            // 1. Process all pending commands from channel non-blocking
            loop {
                match rx.try_recv() {
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
                    Ok(MediaCmd::Shutdown) => return Ok(()),
                    Err(TryRecvError::Empty) => break,
                    Err(TryRecvError::Disconnected) => return Ok(()),
                }
            }

            // 2. Pump Windows Messages (Required for souvlaki's internal window to receive events)
            unsafe {
                let mut msg = MSG::default();
                // PeekMessage with HWND(0) / None checks all windows on this thread
                while PeekMessageW(&mut msg, None, 0, 0, PM_REMOVE).as_bool() {
                    if msg.message == WM_QUIT {
                        return Ok(());
                    }
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
            }

            // 3. Sleep briefly to prevent high CPU usage
            // (A more robust solution would use MsgWaitForMultipleObjects, but this is sufficient for metadata updates)
            thread::sleep(std::time::Duration::from_millis(20));
        }
    }
}
