import { useState, useEffect } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';
import { usePlayerStore } from '../store/playerStore';

export function useCoverArt(coverPath: string | null | undefined) {
    const { coversDir } = usePlayerStore();
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!coverPath || !coversDir) {
            setImageUrl(null);
            return;
        }

        let active = true;
        let objectUrl: string | null = null;

        const loadCover = async () => {
            try {
                // Construct path - use forward slash (works on macOS/Linux)
                const fullPath = `${coversDir}/${coverPath}`;

                const data = await readFile(fullPath);
                const blob = new Blob([data]);
                objectUrl = URL.createObjectURL(blob);

                if (active) {
                    setImageUrl(objectUrl);
                }
            } catch (error) {
                console.error('Failed to load cover:', coverPath, error);
                if (active) setImageUrl(null);
            }
        };

        loadCover();

        return () => {
            active = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [coverPath, coversDir]);

    return imageUrl;
}
