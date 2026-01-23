use crate::audio::{SearchFilter, UnreleasedTrack};
use serde::Deserialize;
use serde_json::Value;

// Invidious instances (generally more reliable than Piped)
const INVIDIOUS_INSTANCES: &[&str] = &[
    "https://invidious.io.lol",
    "https://invidious.private.coffee",
    "https://iv.datura.network",
    "https://invidious.protokolla.fi",
];

// Fallback Piped instances
const PIPED_INSTANCES: &[&str] = &[
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InvidiousItem {
    #[serde(rename = "type")]
    item_type: Option<String>,
    video_id: Option<String>,
    title: Option<String>,
    author: Option<String>,
    length_seconds: Option<f64>,
    video_thumbnails: Option<Vec<InvidiousThumbnail>>,
    view_count: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct InvidiousThumbnail {
    url: Option<String>,
    quality: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PipedItem {
    url: Option<String>,
    title: Option<String>,
    #[serde(rename = "uploaderName")]
    uploader_name: Option<String>,
    duration: Option<f64>,
    thumbnail: Option<String>,
    #[serde(rename = "type")]
    item_type: Option<String>,
}

pub fn search_youtube(filter: SearchFilter) -> Result<Vec<UnreleasedTrack>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Construct query - sanitize special characters for better compatibility
    let mut query = filter.query.clone();
    if let Some(ref content_type) = filter.content_type {
        match content_type.as_str() {
            "slowed_reverb" => query.push_str(" slowed reverb"),
            "loop" => query.push_str(" 1 hour loop"),
            "live" => query.push_str(" live performance"),
            "remix" => query.push_str(" remix"),
            _ => {}
        }
    }

    // Try Invidious first
    if let Ok(tracks) = search_invidious(&client, &query, &filter) {
        if !tracks.is_empty() {
            return Ok(tracks);
        }
    }

    // Fall back to Piped
    search_piped(&client, &query, &filter)
}

fn search_invidious(
    client: &reqwest::blocking::Client,
    query: &str,
    filter: &SearchFilter,
) -> Result<Vec<UnreleasedTrack>, String> {
    let encoded_query = urlencoding::encode(query);
    let mut last_error = String::new();

    for instance in INVIDIOUS_INSTANCES {
        let url = format!("{}/api/v1/search?q={}&type=video", instance, encoded_query);
        println!("[YT Search] Trying Invidious: {}", url);

        let resp = match client
            .get(&url)
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            )
            .send()
        {
            Ok(r) => r,
            Err(e) => {
                println!("[YT Search] {} failed: {}", instance, e);
                last_error = format!("{} failed: {}", instance, e);
                continue;
            }
        };

        if !resp.status().is_success() {
            println!(
                "[YT Search] {} returned status: {}",
                instance,
                resp.status()
            );
            last_error = format!("{} returned status: {}", instance, resp.status());
            continue;
        }

        let text = match resp.text() {
            Ok(t) => t,
            Err(e) => {
                last_error = format!("Failed to get response text: {}", e);
                continue;
            }
        };

        // Invidious returns an array directly
        let items: Vec<InvidiousItem> = match serde_json::from_str(&text) {
            Ok(arr) => arr,
            Err(e) => {
                println!("[YT Search] JSON parse error from {}: {}", instance, e);
                last_error = format!("JSON parse error: {}", e);
                continue;
            }
        };

        let mut tracks = Vec::new();
        let max = filter.max_results.unwrap_or(20) as usize;

        for item in items {
            if item.item_type.as_deref() != Some("video") {
                continue;
            }

            let video_id = match item.video_id {
                Some(id) => id,
                None => continue,
            };

            let thumbnail = item
                .video_thumbnails
                .and_then(|thumbs| {
                    thumbs
                        .into_iter()
                        .find(|t| t.quality.as_deref() == Some("medium"))
                })
                .and_then(|t| t.url);

            let track = UnreleasedTrack {
                video_id,
                title: item.title.unwrap_or_else(|| "Unknown".to_string()),
                artist: item.author.unwrap_or_else(|| "Unknown".to_string()),
                duration_secs: item.length_seconds.unwrap_or(0.0),
                thumbnail_url: thumbnail,
                content_type: filter
                    .content_type
                    .clone()
                    .unwrap_or_else(|| "other".to_string()),
                channel_name: None,
                view_count: item.view_count,
                added_at: None,
            };

            println!(
                "[YT Search] Found: {} by {} ({})",
                track.title, track.artist, track.video_id
            );
            tracks.push(track);

            if tracks.len() >= max {
                break;
            }
        }

        println!(
            "[YT Search] Returning {} tracks from {}",
            tracks.len(),
            instance
        );
        return Ok(tracks);
    }

    Err(format!(
        "All Invidious instances failed. Last error: {}",
        last_error
    ))
}

fn search_piped(
    client: &reqwest::blocking::Client,
    query: &str,
    filter: &SearchFilter,
) -> Result<Vec<UnreleasedTrack>, String> {
    let encoded_query = urlencoding::encode(query);
    let mut last_error = String::new();

    for instance in PIPED_INSTANCES {
        let url = format!("{}/search?q={}&filter=videos", instance, encoded_query);
        println!("[YT Search] Trying Piped: {}", url);

        let resp = match client
            .get(&url)
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            )
            .send()
        {
            Ok(r) => r,
            Err(e) => {
                last_error = format!("{} failed: {}", instance, e);
                continue;
            }
        };

        if !resp.status().is_success() {
            last_error = format!("{} returned status: {}", instance, resp.status());
            continue;
        }

        let text = match resp.text() {
            Ok(t) => t,
            Err(_) => continue,
        };

        let json: Value = match serde_json::from_str(&text) {
            Ok(j) => j,
            Err(_) => continue,
        };

        let items = match json.get("items").and_then(|i| i.as_array()) {
            Some(arr) => arr,
            None => continue,
        };

        let mut tracks = Vec::new();
        let max = filter.max_results.unwrap_or(20) as usize;

        for item_value in items {
            let item: PipedItem = match serde_json::from_value(item_value.clone()) {
                Ok(i) => i,
                Err(_) => continue,
            };

            if item.item_type.as_deref() != Some("stream") {
                continue;
            }

            let url_str = match item.url {
                Some(u) => u,
                None => continue,
            };

            let video_id = url_str.replace("/watch?v=", "");
            if video_id.is_empty() || video_id.contains('/') {
                continue;
            }

            let track = UnreleasedTrack {
                video_id,
                title: item.title.unwrap_or_else(|| "Unknown".to_string()),
                artist: item.uploader_name.unwrap_or_else(|| "Unknown".to_string()),
                duration_secs: item.duration.unwrap_or(0.0),
                thumbnail_url: item.thumbnail,
                content_type: filter
                    .content_type
                    .clone()
                    .unwrap_or_else(|| "other".to_string()),
                channel_name: None,
                view_count: None,
                added_at: None,
            };

            tracks.push(track);
            if tracks.len() >= max {
                break;
            }
        }

        return Ok(tracks);
    }

    Err(format!("All instances failed. Last error: {}", last_error))
}
