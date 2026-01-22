import { useState, useEffect, useMemo } from 'react';
import {
    sourceColorFromImage,
    Hct,
    SchemeTonalSpot,
    hexFromArgb,
    TonalPalette
} from '@material/material-color-utilities';

// ============================================================================
// Types
// ============================================================================

export interface DynamicColors {
    // Key Colors
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

    // Neutral / Surfaces
    surface: string;
    onSurface: string;
    surfaceVariant: string;
    onSurfaceVariant: string;

    // Surface Containers (M3)
    surfaceContainerLowest: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;

    // Utility
    outline: string;
    outlineVariant: string;

    // Raw Palettes (Optional, for advanced usage)
    sourceColor: string;
}

// Fallback "Vibe" Purple
const FALLBACK_SEED = 0xFF6366F1; // #6366F1

// ============================================================================
// Main Hook
// ============================================================================

export function useImageColors(imageUrl: string | null | undefined): DynamicColors {
    const [theme, setTheme] = useState<DynamicColors | null>(null);

    useEffect(() => {
        let active = true;

        const generateTheme = async () => {
            try {
                let sourceColor = FALLBACK_SEED;

                if (imageUrl) {
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.src = imageUrl;
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });

                    // Extract dominant color from image
                    sourceColor = await sourceColorFromImage(img);
                }

                if (!active) return;

                // Create HCT color and Dynamic Scheme
                const hct = Hct.fromInt(sourceColor);
                // SchemeTonalSpot is the default "Material" expressive feel
                // true = isDark (Always Dark Mode for Vibe Music)
                const scheme = new SchemeTonalSpot(hct, true, 0.0);

                // Map tones to roles based on M3 Dark Mode specs
                setTheme({
                    // Primary
                    primary: hexFromArgb(scheme.primaryPalette.tone(80)),
                    onPrimary: hexFromArgb(scheme.primaryPalette.tone(20)),
                    primaryContainer: hexFromArgb(scheme.primaryPalette.tone(30)),
                    onPrimaryContainer: hexFromArgb(scheme.primaryPalette.tone(90)),

                    // Secondary
                    secondary: hexFromArgb(scheme.secondaryPalette.tone(80)),
                    onSecondary: hexFromArgb(scheme.secondaryPalette.tone(20)),
                    secondaryContainer: hexFromArgb(scheme.secondaryPalette.tone(30)),
                    onSecondaryContainer: hexFromArgb(scheme.secondaryPalette.tone(90)),

                    // Tertiary
                    tertiary: hexFromArgb(scheme.tertiaryPalette.tone(80)),
                    onTertiary: hexFromArgb(scheme.tertiaryPalette.tone(20)),
                    tertiaryContainer: hexFromArgb(scheme.tertiaryPalette.tone(30)),
                    onTertiaryContainer: hexFromArgb(scheme.tertiaryPalette.tone(90)),

                    // Surface & Neutral
                    surface: hexFromArgb(scheme.neutralPalette.tone(6)),
                    onSurface: hexFromArgb(scheme.neutralPalette.tone(90)),
                    surfaceVariant: hexFromArgb(scheme.neutralVariantPalette.tone(30)), // often used as "Surface Container Highest" legacy or container
                    onSurfaceVariant: hexFromArgb(scheme.neutralVariantPalette.tone(80)),

                    // Surface Containers (New M3)
                    surfaceContainerLowest: hexFromArgb(scheme.neutralPalette.tone(4)),
                    surfaceContainerLow: hexFromArgb(scheme.neutralPalette.tone(10)),
                    surfaceContainer: hexFromArgb(scheme.neutralPalette.tone(12)),
                    surfaceContainerHigh: hexFromArgb(scheme.neutralPalette.tone(17)),
                    surfaceContainerHighest: hexFromArgb(scheme.neutralPalette.tone(22)),

                    // Utilities
                    outline: hexFromArgb(scheme.neutralVariantPalette.tone(60)),
                    outlineVariant: hexFromArgb(scheme.neutralVariantPalette.tone(30)),

                    sourceColor: hexFromArgb(sourceColor)
                });

            } catch (e) {
                console.error("Failed to generate dynamic theme:", e);
                // Fallback to default if image fails
                if (active && !theme) {
                    // Can rely on the initial default state or set it here
                }
            }
        };

        generateTheme();

        return () => { active = false; };
    }, [imageUrl]);

    // Use memoized default if seed isn't ready
    return useMemo(() => {
        if (theme) return theme;

        // Default Fallback Scheme (based on Indigo/Purple)
        // We replicate the logic synchronously for the fallback
        const hct = Hct.fromInt(FALLBACK_SEED);
        const scheme = new SchemeTonalSpot(hct, true, 0.0);

        return {
            // Primary
            primary: hexFromArgb(scheme.primaryPalette.tone(80)),
            onPrimary: hexFromArgb(scheme.primaryPalette.tone(20)),
            primaryContainer: hexFromArgb(scheme.primaryPalette.tone(30)),
            onPrimaryContainer: hexFromArgb(scheme.primaryPalette.tone(90)),

            // Secondary
            secondary: hexFromArgb(scheme.secondaryPalette.tone(80)),
            onSecondary: hexFromArgb(scheme.secondaryPalette.tone(20)),
            secondaryContainer: hexFromArgb(scheme.secondaryPalette.tone(30)),
            onSecondaryContainer: hexFromArgb(scheme.secondaryPalette.tone(90)),

            // Tertiary
            tertiary: hexFromArgb(scheme.tertiaryPalette.tone(80)),
            onTertiary: hexFromArgb(scheme.tertiaryPalette.tone(20)),
            tertiaryContainer: hexFromArgb(scheme.tertiaryPalette.tone(30)),
            onTertiaryContainer: hexFromArgb(scheme.tertiaryPalette.tone(90)),

            // Surface & Neutral
            surface: hexFromArgb(scheme.neutralPalette.tone(6)),
            onSurface: hexFromArgb(scheme.neutralPalette.tone(90)),
            surfaceVariant: hexFromArgb(scheme.neutralVariantPalette.tone(30)),
            onSurfaceVariant: hexFromArgb(scheme.neutralVariantPalette.tone(80)),

            // Surface Containers
            surfaceContainerLowest: hexFromArgb(scheme.neutralPalette.tone(4)),
            surfaceContainerLow: hexFromArgb(scheme.neutralPalette.tone(10)),
            surfaceContainer: hexFromArgb(scheme.neutralPalette.tone(12)),
            surfaceContainerHigh: hexFromArgb(scheme.neutralPalette.tone(17)),
            surfaceContainerHighest: hexFromArgb(scheme.neutralPalette.tone(22)),

            // Utilities
            outline: hexFromArgb(scheme.neutralVariantPalette.tone(60)),
            outlineVariant: hexFromArgb(scheme.neutralVariantPalette.tone(30)),

            sourceColor: hexFromArgb(FALLBACK_SEED)
        };
    }, [theme]);
}

