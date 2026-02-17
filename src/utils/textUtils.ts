import { TrackInfo } from '../types';

export type DisplayLanguage = 'original' | 'romaji' | 'en';

export const getDisplayText = (
    track: TrackInfo | null,
    field: 'title' | 'artist' | 'album',
    language: DisplayLanguage
): string => {
    if (!track) return '';

    const original = track[field];

    if (language === 'original') return original;

    // Try Romaji
    if (language === 'romaji') {
        const romajiKey = `${field}_romaji` as keyof TrackInfo;
        const romaji = track[romajiKey] as string | undefined | null;
        return romaji || original;
    }

    // Try English / Translation
    if (language === 'en') {
        const enKey = `${field}_en` as keyof TrackInfo;
        const en = track[enKey] as string | undefined | null;
        // Fallback chain: EN -> Romaji -> Original
        if (en) return en;

        // Fallback to Romaji if EN missing? Or straight to Original?
        // Plan said "fallback to Romaji -> Original"
        const romajiKey = `${field}_romaji` as keyof TrackInfo;
        const romaji = track[romajiKey] as string | undefined | null;
        return romaji || original;
    }

    return original;
};
