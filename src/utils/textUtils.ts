import { TrackInfo, TrackDisplay } from '@/types';

export type DisplayLanguage = 'original' | 'romaji' | 'en';

export const getDisplayText = (
    track: TrackInfo | TrackDisplay | null,
    field: 'title' | 'artist' | 'album',
    language: DisplayLanguage
): string => {
    if (!track) return '';

    const original = (track as any)[field] ?? '';

    if (language === 'original') return original;

    // Try Romaji
    if (language === 'romaji') {
        const romajiKey = `${field}_romaji` as keyof TrackDisplay;
        const romaji = (track as any)[romajiKey] as string | undefined | null;
        return (romaji && romaji.trim()) ? romaji : original;
    }

    // Try English / Translation
    if (language === 'en') {
        const enKey = `${field}_en` as keyof TrackDisplay;
        const en = (track as any)[enKey] as string | undefined | null;
        // Fallback chain: EN -> Romaji -> Original
        if (en && en.trim()) return en;

        const romajiKey = `${field}_romaji` as keyof TrackDisplay;
        const romaji = (track as any)[romajiKey] as string | undefined | null;
        return (romaji && romaji.trim()) ? romaji : original;
    }

    return original;
};
