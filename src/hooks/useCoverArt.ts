import { useState, useEffect } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';
import { usePlayerStore } from '../store/playerStore';

// Global cache for cover art blob URLs - persists across component lifecycles
const coverArtCache = new Map<string, string>();
// Track pending loads to prevent duplicate requests
const pendingLoads = new Map<string, Promise<string | null>>();

export function useCoverArt(coverPath: string | null | undefined) {
    const { coversDir } = usePlayerStore();
    const [imageUrl, setImageUrl] = useState<string | null>(() => {
        // Initialize from cache if available
        if (coverPath && coversDir) {
            return coverArtCache.get(coverPath) || null;
        }
        return null;
    });

    useEffect(() => {
        if (!coverPath || !coversDir) {
            setImageUrl(null);
            return;
        }

        // Check cache first
        const cached = coverArtCache.get(coverPath);
        if (cached) {
            setImageUrl(cached);
            return;
        }

        let active = true;

        const loadCover = async () => {
            // Check if already loading
            let loadPromise = pendingLoads.get(coverPath);

            if (!loadPromise) {
                // Start new load
                loadPromise = (async () => {
                    try {
                        const path = `${coversDir}/${coverPath}`.replace(/\\/g, '/');
                        const data = await readFile(path);
                        const blob = new Blob([data]);
                        const objectUrl = URL.createObjectURL(blob);

                        // Cache it (don't revoke - keep in cache)
                        coverArtCache.set(coverPath, objectUrl);
                        return objectUrl;
                    } catch (error) {
                        console.error('Failed to load cover:', coverPath, error);
                        return null;
                    } finally {
                        pendingLoads.delete(coverPath);
                    }
                })();

                pendingLoads.set(coverPath, loadPromise);
            }

            const url = await loadPromise;
            if (active && url) {
                setImageUrl(url);
            }
        };

        loadCover();

        return () => {
            active = false;
            // Don't revoke URL - keep it cached
        };
    }, [coverPath, coversDir]);

    return imageUrl;
}

// Optional: Call this to clear cache if needed (e.g., when library changes)
export function clearCoverArtCache() {
    coverArtCache.forEach(url => URL.revokeObjectURL(url));
    coverArtCache.clear();
}
