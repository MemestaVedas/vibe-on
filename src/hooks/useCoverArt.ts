import { useState, useEffect, useMemo } from 'react';
import { usePlayerStore } from '../store/playerStore';

/**
 * Loads cover art with a robust priority chain:
 * 1. Direct HTTP URL → use as-is
 * 2. Cached cover filename → route through backend HTTP server (port 5000)
 * 3. Full local path → route through backend HTTP server (port 5000)
 * 4. Extraction from audio file → only if allowExtraction is true (e.g. PlayerBar)
 *    (Uses the same backend HTTP endpoint for extraction)
 * 5. null / empty → null
 */
export function useCoverArt(coverPathRaw: string | null | undefined, trackPath?: string, allowExtraction = false) {
    const coversDirRaw = usePlayerStore(s => s.coversDir);

    // Normalize ALL paths to forward slashes (Windows backslash fix)
    const coversDir = useMemo(() => coversDirRaw?.replace(/\\/g, '/') || null, [coversDirRaw]);
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
            //    Bypass native asset protocol, use backend HTTP server
            if (coverPath && !coverPath.includes('/')) {
                if (!cancelled) {
                    setImageUrl(`http://localhost:5000/cover/${encodeURIComponent(coverPath)}`);
                    return;
                }
            }

            // 3. Full local path or track path fallback
            //    Bypass native asset protocol, use backend HTTP server
            if (coverPath) {
                const isAbsolute = coverPath.includes(':') || coverPath.startsWith('/');
                const pathForServer = isAbsolute
                    ? coverPath
                    : coversDir
                        ? `${coversDir}/${coverPath}`
                        : coverPath;

                if (!cancelled) {
                    setImageUrl(`http://localhost:5000/cover/${encodeURIComponent(pathForServer)}`);
                }
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
