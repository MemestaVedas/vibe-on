use serde::{Deserialize, Serialize};

/// LRCLIB API response structure
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsResponse {
    pub id: Option<i64>,
    pub track_name: Option<String>,
    pub artist_name: Option<String>,
    pub album_name: Option<String>,
    pub duration: Option<f64>,
    pub instrumental: Option<bool>,
    pub plain_lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
}

/// Fetch lyrics from LRCLIB API
/// Priority: synced lyrics > plain lyrics
///
/// API: GET https://lrclib.net/api/get?artist_name=X&track_name=Y&duration=Z
pub fn fetch_lyrics(
    artist: &str,
    track: &str,
    duration_secs: u32,
) -> Result<LyricsResponse, String> {
    println!(
        "[Lyrics] Fetching lyrics for: {} - {} ({}s)",
        artist, track, duration_secs
    );

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("vibe-on/1.0 (https://github.com/vibe-on)")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Build query parameters
    let url = format!(
        "https://lrclib.net/api/get?artist_name={}&track_name={}&duration={}",
        urlencoding::encode(artist),
        urlencoding::encode(track),
        duration_secs
    );

    println!("[Lyrics] Request URL: {}", url);

    let response = client
        .get(&url)
        .send()
        .map_err(|e| format!("Failed to fetch lyrics: {}", e))?;

    let status = response.status();

    if status.is_success() {
        let lyrics: LyricsResponse = response
            .json()
            .map_err(|e| format!("Failed to parse lyrics response: {}", e))?;

        if lyrics.synced_lyrics.is_some() {
            println!("[Lyrics] Found synced lyrics!");
        } else if lyrics.plain_lyrics.is_some() {
            println!("[Lyrics] Found plain lyrics (no synced available)");
        } else if lyrics.instrumental.unwrap_or(false) {
            println!("[Lyrics] Track is instrumental");
        } else {
            println!("[Lyrics] No lyrics found in response");
        }

        Ok(lyrics)
    } else if status.as_u16() == 404 {
        println!("[Lyrics] No lyrics found for this track");
        Err("No lyrics found".to_string())
    } else {
        Err(format!("LRCLIB API error: {}", status))
    }
}

/// Try alternative search without duration (sometimes works better)
pub fn fetch_lyrics_fallback(artist: &str, track: &str) -> Result<LyricsResponse, String> {
    println!("[Lyrics] Trying fallback search without duration...");

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("vibe-on/1.0 (https://github.com/vibe-on)")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Search endpoint (returns multiple results)
    let url = format!(
        "https://lrclib.net/api/search?artist_name={}&track_name={}",
        urlencoding::encode(artist),
        urlencoding::encode(track)
    );

    let response = client
        .get(&url)
        .send()
        .map_err(|e| format!("Failed to fetch lyrics: {}", e))?;

    if response.status().is_success() {
        let results: Vec<LyricsResponse> = response
            .json()
            .map_err(|e| format!("Failed to parse search results: {}", e))?;

        // Prefer result with synced lyrics
        if let Some(with_synced) = results.iter().find(|r| r.synced_lyrics.is_some()) {
            println!("[Lyrics] Found synced lyrics via search!");
            return Ok(with_synced.clone());
        }

        // Fallback to any result with plain lyrics
        if let Some(with_plain) = results.iter().find(|r| r.plain_lyrics.is_some()) {
            println!("[Lyrics] Found plain lyrics via search");
            return Ok(with_plain.clone());
        }

        if results.is_empty() {
            Err("No lyrics found".to_string())
        } else {
            // Return first result even if no lyrics
            Ok(results.into_iter().next().unwrap())
        }
    } else {
        Err(format!("Search failed: {}", response.status()))
    }
}

// Need to derive Clone for LyricsResponse to use in fallback search
impl Clone for LyricsResponse {
    fn clone(&self) -> Self {
        LyricsResponse {
            id: self.id,
            track_name: self.track_name.clone(),
            artist_name: self.artist_name.clone(),
            album_name: self.album_name.clone(),
            duration: self.duration,
            instrumental: self.instrumental,
            plain_lyrics: self.plain_lyrics.clone(),
            synced_lyrics: self.synced_lyrics.clone(),
        }
    }
}
