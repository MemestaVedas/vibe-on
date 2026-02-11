import { useMemo } from 'react';
import { usePlayerStore } from '../store/playerStore';

/**
 * Returns the cover image filename or URL for the currently playing track.
 * Normalizes slashes and handles case-insensitivity for reliable lookups on Windows.
 */
export function useCurrentCover(): string | null | undefined {
    const track = usePlayerStore(s => s.status.track);
    const library = usePlayerStore(s => s.library);

    const coverMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const t of library) {
            const cover = t.cover_image || t.cover_url;
            if (cover) {
                // Normalize to forward slashes and lowercase for robust matching
                const key = t.path.replace(/\\/g, '/').toLowerCase();
                map.set(key, cover);
            }
        }
        return map;
    }, [library]);

    if (!track) return null;

    const normalizedPath = track.path.replace(/\\/g, '/').toLowerCase();
    const foundCover = coverMap.get(normalizedPath);

    // Fallback to track's own fields if the library lookup fails
    return foundCover || track.cover_image || track.cover_url || null;
}
