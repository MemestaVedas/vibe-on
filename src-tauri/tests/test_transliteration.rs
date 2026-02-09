use vibe_on_lib::lyrics_transliteration;

#[test]
fn test_has_japanese() {
    assert!(lyrics_transliteration::has_japanese("漢字"));
    assert!(lyrics_transliteration::has_japanese("Hiragana ひらがな"));
    assert!(lyrics_transliteration::has_japanese("Katakana カタカナ"));
    assert!(!lyrics_transliteration::has_japanese("English text"));
}

#[test]
fn test_to_romaji() {
    // Basic check for empty or non-jp
    assert_eq!(lyrics_transliteration::to_romaji("abc"), "abc");

    // "こんにちは" -> "konnichiwa"
    let greeting = lyrics_transliteration::to_romaji("こんにちは");
    println!("Greeting: {}", greeting);
    assert!(greeting.contains("konnichiwa")); // or kon nichi ha depending on tokenizer

    // Kanji
    let kanji = lyrics_transliteration::to_romaji("漢字");
    println!("Kanji: {}", kanji);
    // "kanji"
    assert!(kanji.to_lowercase().contains("kanji"));
    
    // Mixed
    // "私の名前" -> "watashi no namae"
    let mixed = lyrics_transliteration::to_romaji("私の名前");
    println!("Mixed: {}", mixed);
    assert!(mixed.to_lowercase().contains("watashi"));
}

#[test]
fn test_transliterate_lyrics() {
    let input = "[00:01.00] こんにちは\n[00:02.00] English Line\n[00:03.00] 漢字 mixed";
    let output = lyrics_transliteration::transliterate_lyrics(input);
    println!("Output:\n{}", output);
    
    // Check if line 1 has romaji appended
    // Expect: "[00:01.00] こんにちは / konnichiwa" (modulo spaces)
    assert!(output.contains("こんにちは"));
    assert!(output.contains("/"));
    assert!(output.contains("konnichiwa"));

    // Check English line untouched
    assert!(output.contains("[00:02.00] English Line"));
    assert!(!output.contains("[00:02.00] English Line /"));

    // Check mixed line
    assert!(output.contains("[00:03.00] 漢字 mixed"));
    assert!(output.contains("/"));
    assert!(output.contains("kanji"));
}
