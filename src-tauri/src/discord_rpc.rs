use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::{
    sync::mpsc::{self, Sender},
    thread,
    time::{Duration, Instant},
};

// Internal commands for the Discord thread
enum DiscordCommand {
    Connect,
    SetActivity {
        details: String,
        state: String,
        start_timestamp: Option<i64>,
        image_url: Option<String>,
        album_name: Option<String>,
    },
    Clear,
}

#[derive(Clone)]
pub struct DiscordRpc {
    tx: Sender<DiscordCommand>,
    // We keep app_id just in case, though it's used in the thread
    #[allow(dead_code)]
    app_id: String,
}

impl DiscordRpc {
    pub fn new(app_id: &str) -> Self {
        let (tx, rx) = mpsc::channel();
        let app_id_clone = app_id.to_string();

        thread::spawn(move || {
            let mut client: Option<DiscordIpcClient> = None;
            let mut last_connect_attempt = Instant::now() - Duration::from_secs(60);

            // Helper to try connecting
            let mut try_connect = |client_opt: &mut Option<DiscordIpcClient>, id: &str| -> bool {
                if client_opt.is_some() {
                    return true;
                }

                // Rate limit connection attempts
                if last_connect_attempt.elapsed() < Duration::from_secs(10) {
                    return false;
                }
                last_connect_attempt = Instant::now();

                match DiscordIpcClient::new(id) {
                    Ok(mut c) => {
                        if let Ok(_) = c.connect() {
                            println!("[Discord] Connected successfully");
                            *client_opt = Some(c);
                            true
                        } else {
                            // Silent failure to avoid log spam
                            false
                        }
                    }
                    Err(_) => false,
                }
            };

            while let Ok(cmd) = rx.recv() {
                match cmd {
                    DiscordCommand::Connect => {
                        try_connect(&mut client, &app_id_clone);
                    }
                    DiscordCommand::SetActivity {
                        details,
                        state,
                        start_timestamp,
                        image_url,
                        album_name,
                    } => {
                        // Auto-connect if needed
                        if !try_connect(&mut client, &app_id_clone) {
                            continue;
                        }

                        if let Some(c) = client.as_mut() {
                            let mut assets = activity::Assets::new();

                            // Use album art URL if available, otherwise use app icon
                            if let Some(ref url) = image_url {
                                assets = assets.large_image(url).large_text(
                                    album_name.as_deref().unwrap_or("Vibe Music Player"),
                                );
                            } else {
                                assets = assets.large_image("vibe_icon").large_text(
                                    album_name.as_deref().unwrap_or("Vibe Music Player"),
                                );
                            }

                            // Add GitHub button
                            let buttons = vec![activity::Button::new(
                                "View on GitHub",
                                "https://github.com/MemestaVedas/vibe-on",
                            )];

                            let mut activity_payload = activity::Activity::new()
                                .details(&details)
                                .state(&state)
                                .assets(assets)
                                .buttons(buttons);

                            if let Some(start) = start_timestamp {
                                let timestamps = activity::Timestamps::new().start(start);
                                activity_payload = activity_payload.timestamps(timestamps);
                            }

                            if let Err(e) = c.set_activity(activity_payload) {
                                eprintln!("[Discord] Failed to set activity: {}", e);
                                // If we failed, connection might be dead
                                let _ = c.close();
                                client = None;
                            }
                        }
                    }
                    DiscordCommand::Clear => {
                        if let Some(mut c) = client.take() {
                            let _ = c.close();
                        }
                    }
                }
            }
        });

        Self {
            tx,
            app_id: app_id.to_string(),
        }
    }

    pub fn connect(&self) -> Result<(), String> {
        self.tx
            .send(DiscordCommand::Connect)
            .map_err(|e| e.to_string())
    }

    pub fn set_activity(
        &self,
        details: &str,
        state: &str,
        start_timestamp: Option<i64>,
        image_url: Option<String>,
        album_name: Option<String>,
    ) -> Result<(), String> {
        self.tx
            .send(DiscordCommand::SetActivity {
                details: details.to_string(),
                state: state.to_string(),
                start_timestamp,
                image_url,
                album_name,
            })
            .map_err(|e| e.to_string())
    }

    pub fn clear_activity(&self) -> Result<(), String> {
        self.tx
            .send(DiscordCommand::Clear)
            .map_err(|e| e.to_string())
    }
}
