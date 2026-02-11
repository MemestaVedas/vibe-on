import { useState, useEffect, useMemo } from 'react';
import {
    sourceColorFromImage,
    Hct,
    SchemeTonalSpot,
    hexFromArgb
} from '@material/material-color-utilities';

// ============================================================================
// Types
// ============================================================================

export interface DynamicColors {
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondary: string;
    onSecondary: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    tertiary: string;
    onTertiary: string;
    tertiaryContainer: string;
    onTertiaryContainer: string;
    surface: string;
    onSurface: string;
    surfaceVariant: string;
    onSurfaceVariant: string;
    surfaceContainerLowest: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
    outline: string;
    outlineVariant: string;
    sourceColor: string;
}

const FALLBACK_SEED = 0xFF6366F1;

// ============================================================================
// Theme cache — Spotify style: extract once, reuse forever.
// Keyed by imageUrl so switching back to a track is instant + zero-allocation.
// ============================================================================
const themeCache = new Map<string, DynamicColors>();
const MAX_THEME_CACHE = 30;

function buildThemeFromSeed(sourceColor: number): DynamicColors {
    const hct = Hct.fromInt(sourceColor);
    const scheme = new SchemeTonalSpot(hct, true, 0.0);

    return {
        primary: hexFromArgb(scheme.primaryPalette.tone(80)),
        onPrimary: hexFromArgb(scheme.primaryPalette.tone(20)),
        primaryContainer: hexFromArgb(scheme.primaryPalette.tone(30)),
        onPrimaryContainer: hexFromArgb(scheme.primaryPalette.tone(90)),
        secondary: hexFromArgb(scheme.secondaryPalette.tone(80)),
        onSecondary: hexFromArgb(scheme.secondaryPalette.tone(20)),
        secondaryContainer: hexFromArgb(scheme.secondaryPalette.tone(30)),
        onSecondaryContainer: hexFromArgb(scheme.secondaryPalette.tone(90)),
        tertiary: hexFromArgb(scheme.tertiaryPalette.tone(80)),
        onTertiary: hexFromArgb(scheme.tertiaryPalette.tone(20)),
        tertiaryContainer: hexFromArgb(scheme.tertiaryPalette.tone(30)),
        onTertiaryContainer: hexFromArgb(scheme.tertiaryPalette.tone(90)),
        surface: hexFromArgb(scheme.neutralPalette.tone(6)),
        onSurface: hexFromArgb(scheme.neutralPalette.tone(90)),
        surfaceVariant: hexFromArgb(scheme.neutralVariantPalette.tone(30)),
        onSurfaceVariant: hexFromArgb(scheme.neutralVariantPalette.tone(80)),
        surfaceContainerLowest: hexFromArgb(scheme.neutralPalette.tone(4)),
        surfaceContainerLow: hexFromArgb(scheme.neutralPalette.tone(10)),
        surfaceContainer: hexFromArgb(scheme.neutralPalette.tone(12)),
        surfaceContainerHigh: hexFromArgb(scheme.neutralPalette.tone(17)),
        surfaceContainerHighest: hexFromArgb(scheme.neutralPalette.tone(22)),
        outline: hexFromArgb(scheme.neutralVariantPalette.tone(60)),
        outlineVariant: hexFromArgb(scheme.neutralVariantPalette.tone(30)),
        sourceColor: hexFromArgb(sourceColor)
    };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useImageColors(imageUrl: string | null | undefined): DynamicColors {
    const [theme, setTheme] = useState<DynamicColors | null>(() => {
        // Check cache synchronously on mount
        if (imageUrl && themeCache.has(imageUrl)) {
            return themeCache.get(imageUrl)!;
        }
        return null;
    });

    useEffect(() => {
        let active = true;

        const generateTheme = async () => {
            // Cache hit — no work needed
            if (imageUrl && themeCache.has(imageUrl)) {
                if (active) setTheme(themeCache.get(imageUrl)!);
                return;
            }

            try {
                let sourceColor = FALLBACK_SEED;

                if (imageUrl) {
                    // Create a small Image just for color extraction
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.src = imageUrl;
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });

                    sourceColor = await sourceColorFromImage(img);

                    // Explicitly dereference — let GC reclaim the decoded bitmap
                    img.src = '';
                    (img as any).onload = null;
                    (img as any).onerror = null;
                }

                if (!active) return;

                const newTheme = buildThemeFromSeed(sourceColor);

                // Cache the result
                if (imageUrl) {
                    // Evict oldest if full
                    if (themeCache.size >= MAX_THEME_CACHE) {
                        const oldest = themeCache.keys().next().value;
                        if (oldest) themeCache.delete(oldest);
                    }
                    themeCache.set(imageUrl, newTheme);
                }

                setTheme(newTheme);
            } catch (e) {
                console.error("Failed to generate dynamic theme:", e);
            }
        };

        generateTheme();

        return () => { active = false; };
    }, [imageUrl]);

    return useMemo(() => {
        if (theme) return theme;
        return buildThemeFromSeed(FALLBACK_SEED);
    }, [theme]);
}
