use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Debug, Serialize, Deserialize)]
struct ItunesResponse {
    resultCount: i32,
    results: Vec<ItunesResult>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ItunesResult {
    artworkUrl100: Option<String>,
    collectionName: Option<String>,
    artistName: Option<String>,
}

pub fn search_cover(artist: &str, album: &str) -> Option<String> {
    if artist == "Unknown Artist" || album == "Unknown Album" {
        return None;
    }

    let client = reqwest::blocking::Client::new();
    let term = format!("{} {}", artist, album);

    // Params: term, media=music, entity=album, limit=1
    let params = [
        ("term", term.as_str()),
        ("media", "music"),
        ("entity", "album"),
        ("limit", "1"),
    ];

    match client
        .get("https://itunes.apple.com/search")
        .query(&params)
        .send()
    {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(itunes_data) = response.json::<ItunesResponse>() {
                    if let Some(first_result) = itunes_data.results.first() {
                        if let Some(url) = &first_result.artworkUrl100 {
                            // Upgrade quality to 512x512
                            let high_res = url.replace("100x100bb", "512x512bb");
                            return Some(high_res);
                        }
                    }
                }
            }
        }
        Err(e) => eprintln!("Error fetching cover: {}", e),
    }

    None
}
