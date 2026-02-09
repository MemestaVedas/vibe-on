fn main() {
    let lrc = "[00:01.00] Hello";
    let romaji_same = "[00:01.00] Konnichiwa";
    let romaji_diff = "[00:01.000] Konnichiwa"; // 3 decimals vs 2

    println!("Testing Same Precision:");
    let merged_same = merge_lrc_content(lrc, romaji_same);
    println!("{}", merged_same);
    assert!(merged_same.contains("/ Konnichiwa"));

    println!("Testing Diff Precision:");
    let merged_diff = merge_lrc_content(lrc, romaji_diff);
    println!("{}", merged_diff);
    // If this fails, then my hypothesis is correct
    if !merged_diff.contains("/ Konnichiwa") {
        println!("FAIL: Did not merge with different precision");
    } else {
        println!("SUCCESS: Merged with different precision");
    }
}

// Copied from lyrics_fetcher.rs for testing
fn merge_lrc_content(main: &str, romaji: &str) -> String {
    use std::collections::HashMap;

    // Helper to parse timestamp [MM:SS.xx] or [MM:SS.xxx] to milliseconds
    fn parse_timestamp_ms(s: &str) -> Option<u64> {
        let s = s.trim();
        if !s.starts_with('[') || !s.ends_with(']') { return None; }
        let content = &s[1..s.len()-1];
        let parts: Vec<&str> = content.split(':').collect();
        if parts.len() != 2 { return None; }
        
        let min: u64 = parts[0].parse().ok()?;
        
        let sec_parts: Vec<&str> = parts[1].split('.').collect();
        if sec_parts.len() != 2 { return None; }
        
        let sec: u64 = sec_parts[0].parse().ok()?;
        let frac_str = sec_parts[1];
        
        // Handle .xx (centiseconds) vs .xxx (milliseconds)
        let ms: u64 = if frac_str.len() == 2 {
            frac_str.parse::<u64>().ok()? * 10
        } else if frac_str.len() >= 3 {
            frac_str[..3].parse::<u64>().ok()?
        } else {
            frac_str.parse::<u64>().ok()?
        };
        
        Some(min * 60000 + sec * 1000 + ms)
    }

    // Parse romaji into Map: MS -> Text
    let mut romaji_map: HashMap<u64, String> = HashMap::new();
    for line in romaji.lines() {
        if let Some(start) = line.find('[') {
            if let Some(end) = line.find(']') {
                if end > start {
                    let timestamp_str = &line[start..=end];
                    if let Some(ms) = parse_timestamp_ms(timestamp_str) {
                        let text = line[end + 1..].trim();
                        if !text.is_empty() {
                            romaji_map.insert(ms, text.to_string());
                        }
                    }
                }
            }
        }
    }

    let mut result = String::new();

    // Iterate main lines and merge
    for line in main.lines() {
        if let Some(start) = line.find('[') {
            if let Some(end) = line.find(']') {
                let timestamp_str = &line[start..=end];
                let text = line[end + 1..].trim();

                // Try to parse main timestamp to find match
                let match_found = if let Some(ms) = parse_timestamp_ms(timestamp_str) {
                    // Try exact match matching on normalized MS
                    romaji_map.get(&ms)
                } else {
                    None
                };

                if let Some(romaji_text) = match_found {
                    // MERGE!
                    result.push_str(&format!("{} {} / {}\n", timestamp_str, text, romaji_text));
                } else {
                    result.push_str(&format!("{}\n", line));
                }
                continue;
            }
        }
        result.push_str(&format!("{}\n", line));
    }

    result
}
