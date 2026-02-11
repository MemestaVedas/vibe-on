import { useState, useEffect, useMemo } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { readFile } from '@tauri-apps/plugin-fs';

const coverArtCache = new Map<string, string>();
const MAX_CACHE_SIZE = 50;

function touchCache(key: string) {
    const value = coverArtCache.get(key);
    if (value) {
        coverArtCache.delete(key);
        coverArtCache.set(key, value);
    }
}

function evictIfNeeded() {
    if (coverArtCache.size > MAX_CACHE_SIZE) {
        const firstKey = coverArtCache.keys().next().value;
        if (firstKey) {
            const url = coverArtCache.get(firstKey);
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
            coverArtCache.delete(firstKey);
        }
    }
}

/**
 * Loads cover art from disk and manages a micro-cache.
 */
export function useCoverArt(coverPathRaw: string | null | undefined) {
    const coversDir = usePlayerStore(s => s.coversDir);

    // Normalize path to forward slashes for consistent cache keys
    const coverPath = useMemo(() => coverPathRaw?.replace(/\\/g, '/'), [coverPathRaw]);

    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!coverPath || !coversDir) {
            setImageUrl(null);
            return;
        }

        if (coverPath.startsWith('http')) {
            setImageUrl(coverPath);
            return;
        }

        const cached = coverArtCache.get(coverPath);
        if (cached) {
            touchCache(coverPath);
            setImageUrl(cached);
            return;
        }

        const loadCover = async () => {
            try {
                // Handle absolute vs relative paths
                const isAbsolute = coverPath.includes(':') || coverPath.startsWith('/');
                const path = (isAbsolute ? coverPath : `${coversDir}/${coverPath}`).replace(/\\/g, '/');

                const data = await readFile(path);
                const blob = new Blob([data], { type: 'image/jpeg' });
                const url = URL.createObjectURL(blob);

                evictIfNeeded();
                coverArtCache.set(coverPath, url);
                setImageUrl(url);
            } catch (e) {
                console.error('Failed to load cover:', coverPath, e);
                setImageUrl(null);
            }
        };

        loadCover();
    }, [coverPath, coversDir]);

    return imageUrl;
}
