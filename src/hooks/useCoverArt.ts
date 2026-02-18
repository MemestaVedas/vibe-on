import { useState, useEffect, useMemo } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Loads cover art with a robust priority chain:
 * 1. Direct HTTP URL → use as-is
 * 2. Cached cover filename → use native asset protocol directly (NO local server)
 * 3. Full local path → convertFileSrc (native asset protocol)
 * 4. Extraction from audio file → only if allowExtraction is true (e.g. PlayerBar)
 *    (Probeless assignment to avoid network process overhead; backend returns 404 on failure)
 * 5. null / empty → null
 */
export function useCoverArt(coverPathRaw: string | null | undefined, trackPath?: string, allowExtraction = false) {
    const coversDir = usePlayerStore(s => s.coversDir);

    // Normalize path to forward slashes for consistent cache keys
    const coverPath = useMemo(() => coverPathRaw?.replace(/\\/g, '/') || null, [coverPathRaw]);

    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        function resolve() {
            // 1. Already a resolved HTTP URL — use directly
            if (coverPath?.startsWith('http') && !coverPath.includes('asset.localhost')) {
                if (!cancelled) setImageUrl(coverPath);
                return;
            }

            // 2. Cached cover filename (no slashes = just a filename like "abc123.jpg")
            //    BYPASS the local port 5000 server. Use native asset protocol directly.
            if (coverPath && !coverPath.includes('/')) {
                const resolvedPath = coversDir ? `${coversDir}/${coverPath}` : null;
                if (resolvedPath && !cancelled) {
                    setImageUrl(convertFileSrc(resolvedPath));
                    return;
                }
            }

            // 3. Full local path — use native asset protocol
            if (coverPath) {
                const isAbsolute = coverPath.includes(':') || coverPath.startsWith('/');
                const resolvedPath = isAbsolute
                    ? coverPath
                    : coversDir
                        ? `${coversDir}/${coverPath}`
                        : coverPath;
                if (!cancelled) setImageUrl(convertFileSrc(resolvedPath));
                return;
            }

            // 4. No coverPath at all — try backend extraction from audio file.
            //    ONLY if allowExtraction is true (to avoid overwhelming WebKit with 100s of requests in lists)
            if (trackPath && allowExtraction) {
                const encodedPath = encodeURIComponent(trackPath);
                // Assign directly without HEAD probe to reduce network orchestration overhead.
                // WebKit handles individual failing images better than an overwhelmed network process.
                if (!cancelled) setImageUrl(`http://localhost:5000/cover/${encodedPath}`);
                return;
            }

            // 5. Nothing available
            if (!cancelled) setImageUrl(null);
        }

        resolve();
        return () => { cancelled = true; };

    }, [coverPath, coversDir, trackPath, allowExtraction]);

    return imageUrl;
}
