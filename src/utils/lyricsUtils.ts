import { invoke } from '@tauri-apps/api/core';
import { LyricsLine } from '../types';

// Japanese character detection regex ranges
const JP_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

/**
 * Check if text contains Japanese characters (Hiragana, Katakana, or Kanji)
 */
export function hasJapanese(text: string): boolean {
    return JP_REGEX.test(text);
}

/**
 * Convert an array of lyrics lines to Romaji using the Rust backend (lindera)
 */
export async function convertLyrics(lines: LyricsLine[]): Promise<LyricsLine[]> {
    // Collect only lines that need conversion
    const japaneseIndices: number[] = [];
    const textsToConvert: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        if (hasJapanese(lines[i].text)) {
            japaneseIndices.push(i);
            textsToConvert.push(lines[i].text);
        }
    }

    if (textsToConvert.length === 0) return lines;

    // Batch convert via Rust backend IPC — much faster than frontend kuroshiro
    const results = await invoke<(string | null)[]>('convert_lyrics_to_romaji', {
        texts: textsToConvert
    });

    // Merge results back into lines
    const converted = [...lines];
    for (let j = 0; j < japaneseIndices.length; j++) {
        const idx = japaneseIndices[j];
        if (results[j]) {
            converted[idx] = { ...converted[idx], romaji: results[j]! };
        }
    }

    return converted;
}
