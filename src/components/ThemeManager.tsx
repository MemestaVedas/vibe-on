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

    // Update global theme store & CSS Variables
    useEffect(() => {
        setColors(colors);

        // Update CSS Variables for Tailwind M3 Tokens
        const root = document.documentElement;

        // Surface & Backgrounds
        root.style.setProperty('--md-sys-color-surface', colors.background);

        // Use the main background color for containers, but we can darken or lighten slightly if we had HSL util.
        // For now, mapping them to the main background or slightly different tones if available.
        // Since we don't have easy lighten/darken here without util usage, let's map them to background 
        // AND ensure they are opaque. (The extracted colors.background is opaque/rgb).

        root.style.setProperty('--md-sys-color-surface-container-low', colors.background);
        root.style.setProperty('--md-sys-color-surface-container', colors.background);
        root.style.setProperty('--md-sys-color-surface-container-high', colors.background); // We might want a distinct color for this?

        // Actually, for proper contrast, we should mostly rely on opacity/overlays OR distinct colors.
        // If we map all to 'background', we lose hierarchy. 
        // But for "transparency fixing", solid opaque is safer.
        // Let's rely on the fact that M3 often uses 'surface-container' as a higher tone.
        // We can approximate by mixing `on-surface` with low opacity ON TOP of surface? 
        // CSS variables can't do math easily without calc and channels.

        // BETTER FIX: Use the 'backgroundRaw' (which is slightly different tone) but force opacity 1?
        // No, backgroundRaw is .9 alpha.
        // Let's just use colors.background for all surface containers for now to guarantee OPAQUE SOLIDITY.
        // Visual hierarchy might suffer slightly (flat), but it fixes 'transparency'.;


        // Primary
        root.style.setProperty('--md-sys-color-primary', colors.accent1);
        root.style.setProperty('--md-sys-color-on-primary', colors.accent1Foreground);

        // Secondary
        root.style.setProperty('--md-sys-color-secondary', colors.accent2);
        // root.style.setProperty('--md-sys-color-on-secondary', ...); // Need to derive or default to white/black

        // Text
        root.style.setProperty('--md-sys-color-on-surface', colors.textPrimary);
        root.style.setProperty('--md-sys-color-on-surface-variant', colors.textSecondary);

        // Containers (Derive from primary/secondary with opacity if we don't have exact tones)
        // A simple approximation for containers is primary + low opacity
        // Note: Hex colors + opacity is tricky in CSS vars unless we use rgb/hsl values.
        // But useImageColors returns strings (likely hex/rgb).
        // For this iteration, I'll assume the extracted colors are sufficient or I'd need to convert them.
        // Let's rely on the fact that existing CSS uses these vars. 
        // If we need opacity, we might need to change extraction to return HSL or RGB components.
        // For now, let's map what we have directly.

    }, [colors, setColors]);

    return null; // This component renders nothing
}

