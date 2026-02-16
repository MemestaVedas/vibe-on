use lindera_core::mode::Mode;
use lindera_dictionary::{DictionaryConfig, DictionaryKind};
use lindera_tokenizer::tokenizer::{Tokenizer, TokenizerConfig};
use std::sync::OnceLock;
use wana_kana::ConvertJapanese;

// Global Tokenizer instance to avoid reloading dictionary (approx 100ms-500ms)
static TOKENIZER: OnceLock<Tokenizer> = OnceLock::new();

fn get_tokenizer() -> &'static Tokenizer {
    TOKENIZER.get_or_init(|| {
        let dictionary = DictionaryConfig {
            kind: Some(DictionaryKind::IPADIC),
            path: None,
        };
        let config = TokenizerConfig {
            dictionary,
            user_dictionary: None,
            mode: Mode::Normal,
        };

        Tokenizer::from_config(config).unwrap_or_else(|e| {
            eprintln!("Failed to initialize Lindera tokenizer: {}", e);
            panic!("Tokenizer init failed: {}", e);
        })
    })
}

/// Check if text contains Japanese characters (Hiragana, Katakana, Kanji)
pub fn has_japanese(text: &str) -> bool {
    text.chars().any(|c| {
        let u = c as u32;
        // Hiragana: 3040-309F
        // Katakana: 30A0-30FF
        // Kanji: 4E00-9FAF
        (0x3040..=0x309F).contains(&u)
            || (0x30A0..=0x30FF).contains(&u)
            || (0x4E00..=0x9FAF).contains(&u)
    })
}

/// Transliterate Japanese text to Romaji
pub fn to_romaji(text: &str) -> String {
    if !has_japanese(text) {
        return text.to_string();
    }

    let tokenizer = get_tokenizer();
    let tokens = match tokenizer.tokenize(text) {
        Ok(t) => t,
        Err(e) => {
            println!("[Transliteration] Tokenize failed for '{}': {}", text, e);
            return text.to_string();
        }
    };

    let mut result = String::new();

    for mut token in tokens {
        // Token details: [POS, POS-detail, ..., Reading, Pronunciation]
        // Index 7 is Reading (Katakana)
        // Linera 0.24+ (or specific version): Use get_details() which lazily loads details

        // Use the reading if available (last item often, or specific index 7 for IPADIC)
        let reading = if let Some(details) = token.get_details() {
            if details.len() > 7 && details[7] != "*" {
                details[7].to_string()
            } else {
                token.text.to_string()
            }
        } else {
            token.text.to_string()
        };

        // Convert the reading (Katakana) to Romaji
        let romaji = reading.to_romaji();

        // Proper spacing strategies:
        // Japanese text doesn't have spaces. Romaji needs them between words.
        // We append a space after each token's romaji.
        if !result.is_empty() && !result.ends_with(' ') {
            result.push(' ');
        }
        result.push_str(&romaji);
    }

    // Post-processing: Title Case?
    // "aoi sora" -> "Aoi Sora" usually looks better for titles.
    // Let's do simple capitalization of first letter of sentence for now, or each word?
    // Title Case for metadata is safer.
    to_title_case(&result.trim())
}

fn to_title_case(s: &str) -> String {
    s.split_whitespace()
        .map(|word| {
            let mut c = word.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<String>>()
        .join(" ")
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

                    let romaji = text.to_romaji();
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
