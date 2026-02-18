import { useState, useEffect, useMemo } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Loads cover art using Tauri's asset protocol which works in production.
 */
export function useCoverArt(coverPathRaw: string | null | undefined, trackPath?: string) {
    const coversDir = usePlayerStore(s => s.coversDir);

    // Normalize path to forward slashes for consistent cache keys
    const coverPath = useMemo(() => coverPathRaw?.replace(/\\/g, '/'), [coverPathRaw]);

    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        // If we have a direct HTTP URL, use it
        if (coverPath?.startsWith('http')) {
            setImageUrl(coverPath);
            return;
        }

        // If we have a local cover path, use it via Tauri asset protocol
        if (coverPath && coversDir) {
            // Handle absolute vs relative paths
            const isAbsolute = coverPath.includes(':') || coverPath.startsWith('/');
            const path = (isAbsolute ? coverPath : `${coversDir}/${coverPath}`).replace(/\\/g, '/');
            const assetUrl = convertFileSrc(path);
            setImageUrl(assetUrl);
            return;
        }

        // Fallback: If no local cover but we have track path, use server URL (which triggers extraction)
        if (!coverPath && trackPath) {
            // Use localhost:5000 to fetch cover (triggers lazy extraction in backend)
            const encodedPath = encodeURIComponent(trackPath);
            // Add timestamp to prevent aggressive browser caching if needed, but backend sends cache-control
            setImageUrl(`http://localhost:5000/cover/${encodedPath}`);
            return;
        }

        setImageUrl(null);

    }, [coverPath, coversDir, trackPath]);

    return imageUrl;
}
