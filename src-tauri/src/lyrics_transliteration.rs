use lindera_tokenizer::tokenizer::{Tokenizer, TokenizerConfig};
use wana_kana::to_romaji;

/// Check if text contains Japanese characters (Hiragana, Katakana, Kanji)
pub fn has_japanese(text: &str) -> bool {
    text.chars().any(|c| {
        let u = c as u32;
        // Hiragana: 3040-309F
        // Katakana: 30A0-30FF
        // Kanji: 4E00-9FAF
        (0x3040..=0x309F).contains(&u) || 
        (0x30A0..=0x30FF).contains(&u) || 
        (0x4E00..=0x9FAF).contains(&u)
    })
}

/// Transliterate Japanese text to Romaji
pub fn to_romaji(text: &str) -> String {
    // 1. Initialize Lindera Tokenizer (IPADIC)
    // In production, we might want to initialize this once globally as it loads dict into memory.
    // For now, let's init per call or use lazy_static if performance is an issue.
    // Given lyrics are fetched infrequently, per-call is likely fine but loading dict takes time.
    // Let's use std::sync::OnceLock or similar if we can, but simpler first.
    
    let config = TokenizerConfig::default();
    
    // This might be slow if called repeatedly. 
    // Optimization TODO: cache the tokenizer.
    let tokenizer = match Tokenizer::from_config(config) {
        Ok(t) => t,
        Err(_) => return text.to_string(), // Fallback if tokenizer fails
    };

    let tokens = match tokenizer.tokenize(text) {
        Ok(t) => t,
        Err(_) => return text.to_string(),
    };

    let mut result = String::new();

    for token in tokens {
        // Token details: [POS, POS-detail, ..., Reading, Pronunciation]
        // Usually details[7] is Reading (Katakana)
        // If not available (e.g. unknown word), use surface form.
        

        let json_val = serde_json::to_value(&token).unwrap_or(serde_json::Value::Null);
        
        let surface = json_val.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string();
        
        let details_vec: Vec<String> = if let Some(arr) = json_val.get("details").and_then(|v| v.as_array()) {
             arr.iter().map(|v| v.as_str().unwrap_or("").to_string()).collect()
        } else {
             Vec::new()
        };

        let reading = if details_vec.len() > 7 && details_vec[7] != "*" {
            details_vec[7].clone()
        } else {
            surface.clone()
        };

        
        // Convert the reading (which is usually Katakana for known words) to Romaji
        // Or if it's already Romaji/English, wana_kana handles it gracefully?
        // simple to_romaji might convert English text oddly if not careful? 
        // wana_kana::to_romaji usually leaves Latin alone.
        
        let romaji = to_romaji(&reading);
        result.push_str(&romaji);
        result.push(' '); // Spacer? 
        // Kuroshiro 'spaced' mode adds spaces.
    }

    // Clean up spaces
    result.trim().to_string()
}

/// Convert lyrics content (multiple lines) to Romaji
/// Preserves structure but converts Japanese lines.
pub fn transliterate_lyrics(content: &str) -> String {
    let mut result = String::new();
    
    for line in content.lines() {
        if let Some(start) = line.find('[') {
             if let Some(end) = line.find(']') {
                let timestamp = &line[start..=end];
                let text = line[end + 1..].trim();
                
                if has_japanese(text) {
                     // Verify if it needs conversion. 
                     // Sometimes lyrics line is empty or just punctuation.
                     if text.is_empty() {
                         result.push_str(&format!("{}\n", line));
                         continue;
                     }
                     
                     let romaji = to_romaji(text);
                     // Heuristic: if romaji is vastly different or just same, handle?
                     // Verify " / " separator isn't already there?
                     // The requirement is to MERGE.
                     // Wait, if I'm transliterating, I probably want to REPLACE the line 
                     // OR append it like merge logic.
                     // "Original / Romaji"
                     
                     // check if line already has " / "
                     if text.contains(" / ") {
                         // assume already merged? or maybe just update
                         result.push_str(&format!("{}\n", line));
                     } else {
                         // Append Romaji
                         result.push_str(&format!("{} {} / {}\n", timestamp, text, romaji));
                     }
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
