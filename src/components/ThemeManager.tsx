import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { useImageColors } from '../hooks/useImageColors';
import { useThemeStore } from '../store/themeStore';

export function ThemeManager() {
    const track = usePlayerStore(state => state.status.track);
    const library = usePlayerStore(state => state.library);
    const setColors = useThemeStore(state => state.setColors);

    // Get cover URL
    const currentIndex = library.findIndex(t => t.path === track?.path);
    const currentLibraryTrack = currentIndex >= 0 ? library[currentIndex] : null;
    const coverUrl = useCoverArt(currentLibraryTrack?.cover_image);

    // Extract colors
    const colors = useImageColors(coverUrl);

    // Update global theme store
    useEffect(() => {
        setColors(colors);
    }, [colors, setColors]);

    return null; // This component renders nothing
}
