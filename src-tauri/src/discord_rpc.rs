use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;

pub struct DiscordRpc {
    client: Mutex<Option<DiscordIpcClient>>,
    app_id: String,
}

impl DiscordRpc {
    pub fn new(app_id: &str) -> Self {
        Self {
            client: Mutex::new(None),
            app_id: app_id.to_string(),
        }
    }

    pub fn connect(&self) -> Result<(), String> {
        let mut client_guard = self.client.lock().map_err(|e| e.to_string())?;

        if client_guard.is_some() {
            return Ok(());
        }

        let mut client = DiscordIpcClient::new(&self.app_id).map_err(|e| e.to_string())?;

        match client.connect() {
            Ok(_) => {
                println!("Connected to Discord RPC");
                *client_guard = Some(client);
                Ok(())
            }
            Err(e) => {
                eprintln!("Failed to connect to Discord RPC: {}", e);
                Ok(())
            }
        }
    }

    pub fn set_activity(
        &self,
        details: &str,
        state: &str,
        duration_secs: Option<f64>,
        _image_url: Option<String>,
        _album_name: Option<String>,
    ) -> Result<(), String> {
        let mut client_guard = self.client.lock().map_err(|e| e.to_string())?;

        if let Some(client) = client_guard.as_mut() {
            let mut assets = activity::Assets::new();

            // Per user request: use the default app icon only
            assets = assets
                .large_image("vibe_icon")
                .large_text("Vibe Music Player");

            let mut activity = activity::Activity::new()
                .details(details)
                .state(state)
                .assets(assets);

            if let Some(_duration) = duration_secs {
                let start = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                activity = activity.timestamps(activity::Timestamps::new().start(start));
            }

            match client.set_activity(activity) {
                Ok(_) => Ok(()),
                Err(e) => {
                    eprintln!("Failed to set Discord activity: {}", e);
                    Ok(())
                }
            }
        } else {
            Ok(())
        }
    }

    pub fn clear_activity(&self) -> Result<(), String> {
        let mut client_guard = self.client.lock().map_err(|e| e.to_string())?;

        if let Some(client) = client_guard.as_mut() {
            let _ = client.close();
        }
        *client_guard = None;
        Ok(())
    }
}
