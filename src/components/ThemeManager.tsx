import { useEffect } from 'react';

import { useCurrentCover } from '../hooks/useCurrentCover';
import { useCoverArt } from '../hooks/useCoverArt';
import { useImageColors } from '../hooks/useImageColors';
import { useThemeStore } from '../store/themeStore';
import { usePlayerStore } from '../store/playerStore';

export function ThemeManager() {
    // Only subscribe to the current track's cover — NOT the entire library
    const coverImage = useCurrentCover();
    const setColors = useThemeStore(s => s.setColors);

    // Get track for fallback URL generation
    const track = usePlayerStore(s => s.status.track);

    // Get cover URL from the tiny thumbnail cache
    const coverUrl = useCoverArt(coverImage, track?.path, true);

    // Extract colors using M3 Logic (results are cached by imageUrl)
    const colors = useImageColors(coverUrl);

    // Update global theme store & CSS Variables
    useEffect(() => {
        setColors(colors);

        const root = document.documentElement;

        // Primary
        root.style.setProperty('--md-sys-color-primary', colors.primary);
        root.style.setProperty('--md-sys-color-on-primary', colors.onPrimary);
        root.style.setProperty('--md-sys-color-primary-container', colors.primaryContainer);
        root.style.setProperty('--md-sys-color-on-primary-container', colors.onPrimaryContainer);

        // Secondary
        root.style.setProperty('--md-sys-color-secondary', colors.secondary);
        root.style.setProperty('--md-sys-color-on-secondary', colors.onSecondary);
        root.style.setProperty('--md-sys-color-secondary-container', colors.secondaryContainer);
        root.style.setProperty('--md-sys-color-on-secondary-container', colors.onSecondaryContainer);

        // Tertiary
        root.style.setProperty('--md-sys-color-tertiary', colors.tertiary);
        root.style.setProperty('--md-sys-color-on-tertiary', colors.onTertiary);
        root.style.setProperty('--md-sys-color-tertiary-container', colors.tertiaryContainer);
        root.style.setProperty('--md-sys-color-on-tertiary-container', colors.onTertiaryContainer);

        // Surface & Text
        root.style.setProperty('--md-sys-color-surface', colors.surface);
        root.style.setProperty('--md-sys-color-on-surface', colors.onSurface);
        root.style.setProperty('--md-sys-color-surface-variant', colors.surfaceVariant);
        root.style.setProperty('--md-sys-color-on-surface-variant', colors.onSurfaceVariant);

        // Surface Containers
        root.style.setProperty('--md-sys-color-surface-container-lowest', colors.surfaceContainerLowest);
        root.style.setProperty('--md-sys-color-surface-container-low', colors.surfaceContainerLow);
        root.style.setProperty('--md-sys-color-surface-container', colors.surfaceContainer);
        root.style.setProperty('--md-sys-color-surface-container-high', colors.surfaceContainerHigh);
        root.style.setProperty('--md-sys-color-surface-container-highest', colors.surfaceContainerHighest);

        // Outline
        root.style.setProperty('--md-sys-color-outline', colors.outline);
        root.style.setProperty('--md-sys-color-outline-variant', colors.outlineVariant);

    }, [colors, setColors]);

    return null;
}
