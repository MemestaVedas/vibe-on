use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ItunesResponse {
    result_count: i32,
    results: Vec<ItunesResult>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ItunesResult {
    artwork_url100: Option<String>,
    collection_name: Option<String>,
    artist_name: Option<String>,
}

/// Try to fetch album artwork from iTunes
pub fn search_cover(artist: &str, album: &str) -> Option<String> {
    if artist == "Unknown Artist" || album == "Unknown Album" {
        return None;
    }

    // First try: exact search with album matching
    println!("[Cover] Searching for: {} - {}", artist, album);

    // Try artist + album with matching
    let full_term = format!("{} {}", artist, album);
    if let Some(url) = search_itunes_with_match(&full_term, artist, album) {
        return Some(url);
    }

    // Try just artist with album matching
    if let Some(url) = search_itunes_with_match(artist, artist, album) {
        return Some(url);
    }

    // Try ASCII-only version
    let ascii_term = strip_non_ascii(&full_term);
    let ascii_album = strip_non_ascii(album);
    if !ascii_term.trim().is_empty() {
        if let Some(url) = search_itunes_with_match(&ascii_term, artist, &ascii_album) {
            return Some(url);
        }
    }

    println!("[Cover] No matching cover found");
    None
}

/// Strip non-ASCII characters from a string
fn strip_non_ascii(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii()).collect::<String>()
}

/// Check if the iTunes result matches our expected album
fn matches_album(result: &ItunesResult, expected_artist: &str, expected_album: &str) -> bool {
    // Extract keywords from expected album (words > 3 chars to avoid articles)
    let album_keywords: Vec<String> = expected_album
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() > 3)
        .map(|w| w.to_lowercase())
        .collect();

    // Check collection name
    if let Some(ref collection) = result.collection_name {
        let collection_lower = collection.to_lowercase();

        // Check if at least one significant keyword matches
        for keyword in &album_keywords {
            if collection_lower.contains(keyword) {
                println!("[Cover] Matched keyword '{}' in '{}'", keyword, collection);
                return true;
            }
        }
    }

    // Check if artist matches at least
    if let Some(ref artist) = result.artist_name {
        let artist_lower = artist.to_lowercase();
        let expected_lower = expected_artist.to_lowercase();
        if artist_lower.contains(&expected_lower) || expected_lower.contains(&artist_lower) {
            // Artist matches, but album doesn't - we'll use it as fallback
            println!("[Cover] Artist '{}' matches, using as fallback", artist);
            return true;
        }
    }

    false
}

/// Perform iTunes API search with result matching
fn search_itunes_with_match(
    term: &str,
    expected_artist: &str,
    expected_album: &str,
) -> Option<String> {
    println!("[Cover] Trying: {}", term);

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok()?;

    let params = [
        ("term", term),
        ("media", "music"),
        ("entity", "album"),
        ("limit", "10"), // Get more results to find a match
    ];

    match client
        .get("https://itunes.apple.com/search")
        .query(&params)
        .send()
    {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(itunes_data) = response.json::<ItunesResponse>() {
                    println!("[Cover] Got {} results", itunes_data.result_count);

                    // Find best matching result
                    for result in &itunes_data.results {
                        if matches_album(result, expected_artist, expected_album) {
                            if let Some(ref url) = result.artwork_url100 {
                                let high_res = url.replace("100x100bb", "512x512bb");
                                println!(
                                    "[Cover] Using: {} - {:?}",
                                    result.artist_name.as_deref().unwrap_or("?"),
                                    result.collection_name.as_deref().unwrap_or("?")
                                );
                                return Some(high_res);
                            }
                        }
                    }
                }
            }
        }
        Err(e) => eprintln!("[Cover] Error: {}", e),
    }

    None
}
