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
        // console.log('[useCoverArt] Input:', { coverPath, trackPath, coversDir });

        // If we have a direct HTTP URL, use it
        if (coverPath?.startsWith('http') && !coverPath.includes('asset.localhost')) {
            // console.log('[useCoverArt] Using direct HTTP URL:', coverPath);
            setImageUrl(coverPath);
            return;
        }

        // PRIORITIZE BACKEND SERVER (Port 5000) for Cached Filenames
        // If we have a cached cover filename (no slashes), serve it directly from backend.
        if (coverPath && !coverPath.includes('/')) {
            const encodedCover = encodeURIComponent(coverPath);
            // console.log('[useCoverArt] Using cached filename via backend:', coverPath);
            setImageUrl(`http://localhost:5000/cover/${encodedCover}`);
            return;
        }

        // If we have a track path, use the backend server to fetch the cover.
        if (trackPath) {
            const encodedPath = encodeURIComponent(trackPath);
            const url = `http://localhost:5000/cover/${encodedPath}`;
            setImageUrl(url);
            return;
        }

        // Fallback: If no track path but we have a local cover path (e.g. legacy/manual usage)
        // This likely still fails if asset protocol is broken, but we keep it just in case.
        if (coverPath && coversDir) {
            // Handle absolute vs relative paths
            const isAbsolute = coverPath.includes(':') || coverPath.startsWith('/');
            const path = (isAbsolute ? coverPath : `${coversDir}/${coverPath}`).replace(/\\/g, '/');
            const assetUrl = convertFileSrc(path);
            setImageUrl(assetUrl);
            return;
        }

        setImageUrl(null);

    }, [coverPath, coversDir, trackPath]);

    return imageUrl;
}
