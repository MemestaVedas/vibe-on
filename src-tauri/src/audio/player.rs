use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Instant;

use lofty::prelude::*;
use lofty::probe::Probe;
use rodio::{Decoder, OutputStream, Sink};

use super::state::{PlayerState, PlayerStatus, TrackInfo};

/// Commands sent to the audio thread
pub enum AudioCommand {
    Play(String),
    Pause,
    Resume,
    Stop,
    SetVolume(f32),
    GetStatus(Sender<PlayerStatus>),
    Shutdown,
}

/// Thread-safe handle to the audio player
pub struct AudioPlayer {
    command_tx: Sender<AudioCommand>,
    _thread: JoinHandle<()>,
}

impl AudioPlayer {
    /// Create a new audio player with a dedicated audio thread
    pub fn new() -> Result<Self, String> {
        let (command_tx, command_rx) = channel::<AudioCommand>();

        let thread = thread::spawn(move || {
            AudioThread::run(command_rx);
        });

        Ok(Self {
            command_tx,
            _thread: thread,
        })
    }

    pub fn play_file(&self, path: &str) -> Result<(), String> {
        self.command_tx
            .send(AudioCommand::Play(path.to_string()))
            .map_err(|e| format!("Failed to send play command: {}", e))
    }

    pub fn pause(&self) -> Result<(), String> {
        self.command_tx
            .send(AudioCommand::Pause)
            .map_err(|e| format!("Failed to send pause command: {}", e))
    }

    pub fn resume(&self) -> Result<(), String> {
        self.command_tx
            .send(AudioCommand::Resume)
            .map_err(|e| format!("Failed to send resume command: {}", e))
    }

    pub fn stop(&self) -> Result<(), String> {
        self.command_tx
            .send(AudioCommand::Stop)
            .map_err(|e| format!("Failed to send stop command: {}", e))
    }

    pub fn set_volume(&self, value: f32) -> Result<(), String> {
        self.command_tx
            .send(AudioCommand::SetVolume(value))
            .map_err(|e| format!("Failed to send volume command: {}", e))
    }

    pub fn get_status(&self) -> PlayerStatus {
        let (tx, rx) = channel();
        if self.command_tx.send(AudioCommand::GetStatus(tx)).is_ok() {
            rx.recv().unwrap_or_default()
        } else {
            PlayerStatus::default()
        }
    }
}

impl Drop for AudioPlayer {
    fn drop(&mut self) {
        let _ = self.command_tx.send(AudioCommand::Shutdown);
    }
}

/// The actual audio thread that owns the non-Send types
struct AudioThread {
    sink: Option<Sink>,
    _stream: OutputStream,
    state: PlayerState,
    current_track: Option<TrackInfo>,
    volume: f32,
    play_start_time: Option<Instant>,
    accumulated_time: f64,
}

impl AudioThread {
    fn run(command_rx: Receiver<AudioCommand>) {
        // Initialize audio output on this thread
        let (stream, stream_handle) = match OutputStream::try_default() {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to open audio device: {}", e);
                return;
            }
        };

        let mut audio = AudioThread {
            sink: None,
            _stream: stream,
            state: PlayerState::Stopped,
            current_track: None,
            volume: 1.0,
            play_start_time: None,
            accumulated_time: 0.0,
        };

        // Store stream_handle for creating sinks
        let stream_handle = Arc::new(stream_handle);

        loop {
            match command_rx.recv() {
                Ok(AudioCommand::Play(path)) => {
                    audio.handle_play(&path, &stream_handle);
                }
                Ok(AudioCommand::Pause) => {
                    audio.handle_pause();
                }
                Ok(AudioCommand::Resume) => {
                    audio.handle_resume();
                }
                Ok(AudioCommand::Stop) => {
                    audio.handle_stop();
                }
                Ok(AudioCommand::SetVolume(value)) => {
                    audio.handle_set_volume(value);
                }
                Ok(AudioCommand::GetStatus(tx)) => {
                    let status = audio.get_status();
                    let _ = tx.send(status);
                }
                Ok(AudioCommand::Shutdown) | Err(_) => {
                    break;
                }
            }
        }
    }

    fn handle_play(&mut self, path: &str, stream_handle: &Arc<rodio::OutputStreamHandle>) {
        // Stop current playback
        self.handle_stop();

        let path = Path::new(path);

        // Open and decode the file
        let file = match File::open(path) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("Failed to open file: {}", e);
                return;
            }
        };
        // Increase buffer size to prevent underruns (static/breaking)
        let reader = BufReader::with_capacity(128 * 1024, file);
        let source = match Decoder::new(reader) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to decode audio: {}", e);
                return;
            }
        };

        // Extract metadata
        let track_info = self.extract_metadata(path);

        // Create new sink and play
        let sink = match Sink::try_new(stream_handle) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to create audio sink: {}", e);
                return;
            }
        };

        sink.set_volume(self.volume);
        sink.append(source);

        self.sink = Some(sink);
        self.state = PlayerState::Playing;
        self.current_track = Some(track_info);
        self.play_start_time = Some(Instant::now());
        self.accumulated_time = 0.0;
    }

    fn extract_metadata(&self, path: &Path) -> TrackInfo {
        let tagged_file = match Probe::open(path).and_then(|p| p.read()) {
            Ok(f) => f,
            Err(_) => {
                return TrackInfo {
                    path: path.to_string_lossy().to_string(),
                    title: path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("Unknown")
                        .to_string(),
                    artist: "Unknown Artist".to_string(),
                    album: "Unknown Album".to_string(),
                    duration_secs: 0.0,
                    cover_image: None,
                };
            }
        };

        let properties = tagged_file.properties();
        let duration_secs = properties.duration().as_secs_f64();

        let (title, artist, album) = if let Some(tag) = tagged_file.primary_tag() {
            (
                tag.title().map(|s| s.to_string()).unwrap_or_else(|| {
                    path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("Unknown")
                        .to_string()
                }),
                tag.artist()
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "Unknown Artist".to_string()),
                tag.album()
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "Unknown Album".to_string()),
            )
        } else {
            (
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unknown")
                    .to_string(),
                "Unknown Artist".to_string(),
                "Unknown Album".to_string(),
            )
        };

        TrackInfo {
            path: path.to_string_lossy().to_string(),
            title,
            artist,
            album,
            duration_secs,
            cover_image: None,
        }
    }

    fn handle_pause(&mut self) {
        if let Some(ref sink) = self.sink {
            sink.pause();

            // Update accumulated time
            if let Some(start) = self.play_start_time {
                self.accumulated_time += start.elapsed().as_secs_f64();
            }
            self.play_start_time = None;
            self.state = PlayerState::Paused;
        }
    }

    fn handle_resume(&mut self) {
        if let Some(ref sink) = self.sink {
            sink.play();
            self.play_start_time = Some(Instant::now());
            self.state = PlayerState::Playing;
        }
    }

    fn handle_stop(&mut self) {
        if let Some(sink) = self.sink.take() {
            sink.stop();
        }
        self.state = PlayerState::Stopped;
        self.current_track = None;
        self.play_start_time = None;
        self.accumulated_time = 0.0;
    }

    fn handle_set_volume(&mut self, value: f32) {
        self.volume = value.clamp(0.0, 1.0);
        if let Some(ref sink) = self.sink {
            sink.set_volume(self.volume);
        }
    }

    fn get_status(&self) -> PlayerStatus {
        let position_secs = {
            let current = self
                .play_start_time
                .map(|start| start.elapsed().as_secs_f64())
                .unwrap_or(0.0);
            self.accumulated_time + current
        };

        PlayerStatus {
            state: self.state,
            track: self.current_track.clone(),
            position_secs,
            volume: self.volume,
        }
    }
}
