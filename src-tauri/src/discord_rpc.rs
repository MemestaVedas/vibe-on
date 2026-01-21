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
                // Don't return error to simple allow app to run without discord
                Ok(())
            }
        }
    }

    pub fn set_activity(
        &self,
        details: &str,
        state: &str,
        duration_secs: Option<f64>,
        image_url: Option<String>,
        album_name: Option<String>,
    ) -> Result<(), String> {
        let mut client_guard = self.client.lock().map_err(|e| e.to_string())?;

        if let Some(client) = client_guard.as_mut() {
            // Clone to owned strings to ensure they live long enough
            let image_url_owned = image_url;
            let album_name_owned = album_name;

            let mut assets = activity::Assets::new();

            // Set large image: use URL if provided, otherwise default icon
            if let Some(ref url) = image_url_owned {
                println!("[Discord] Setting large image URL: {}", url);
                assets = assets.large_image(url);
            } else {
                println!("[Discord] No image URL, using default icon");
                assets = assets.large_image("vibe_icon");
            }

            // Set hover text (tooltip): use Album name if provided, otherwise default
            if let Some(ref album) = album_name_owned {
                assets = assets.large_text(album);
            } else {
                assets = assets.large_text("Vibe Music Player");
            }

            let mut activity = activity::Activity::new()
                .details(details)
                .state(state)
                .assets(assets);

            if let Some(_duration) = duration_secs {
                let start = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                // Only set start time to show elapsed time (not countdown)
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
            // Re-connecting usually requires new client or reconnect
            // For now just clearing activity might be enough?
            // client.clear_activity(); // Not always available or reliable
        }
        *client_guard = None; // Force reconnect next time
        Ok(())
    }
}
