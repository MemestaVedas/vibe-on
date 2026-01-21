import { useState, useEffect, useMemo } from 'react';

// ============================================================================
// Color Utility Functions
// ============================================================================

interface RGB {
    r: number;
    g: number;
    b: number;
}

// Parse rgb(r, g, b) string to RGB object - kept for potential future use
// function parseRgb(rgbString: string): RGB | null {
//     const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
//     if (!match) return null;
//     return {
//         r: parseInt(match[1]),
//         g: parseInt(match[2]),
//         b: parseInt(match[3])
//     };
// }

// Convert RGB to string
function rgbToString(rgb: RGB): string {
    return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
}

// Calculate relative luminance (WCAG formula)
function getLuminance(rgb: RGB): number {
    const rsRGB = rgb.r / 255;
    const gsRGB = rgb.g / 255;
    const bsRGB = rgb.b / 255;

    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio between two colors
function getContrastRatio(rgb1: RGB, rgb2: RGB): number {
    const lum1 = getLuminance(rgb1);
    const lum2 = getLuminance(rgb2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
}

// Darken a color by a factor (0-1, where 0.5 = 50% darker)
function darkenColor(rgb: RGB, factor: number): RGB {
    return {
        r: rgb.r * (1 - factor),
        g: rgb.g * (1 - factor),
        b: rgb.b * (1 - factor)
    };
}

// Lighten a color
function lightenColor(rgb: RGB, factor: number): RGB {
    return {
        r: rgb.r + (255 - rgb.r) * factor,
        g: rgb.g + (255 - rgb.g) * factor,
        b: rgb.b + (255 - rgb.b) * factor
    };
}

// Saturate a color (increase vibrancy)
function saturateColor(rgb: RGB, factor: number): RGB {
    const gray = 0.2989 * rgb.r + 0.5870 * rgb.g + 0.1140 * rgb.b;
    return {
        r: Math.min(255, Math.max(0, gray + (rgb.r - gray) * (1 + factor))),
        g: Math.min(255, Math.max(0, gray + (rgb.g - gray) * (1 + factor))),
        b: Math.min(255, Math.max(0, gray + (rgb.b - gray) * (1 + factor)))
    };
}

// Get color "vibrancy" (saturation-like score)
function getVibrancy(rgb: RGB): number {
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    if (max === 0) return 0;
    return (max - min) / max;
}

// ============================================================================
// Default Colors
// ============================================================================

const DEFAULT_DARK = '#0a0a0f';
const DEFAULT_LIGHT = '#f5f5f5';
const DEFAULT_ACCENT = '#6366f1'; // Indigo

export interface DynamicColors {
    background: string;      // Darkened dominant color
    backgroundRaw: string;   // Original dominant color
    accent1: string;         // High-contrast accent for buttons
    accent2: string;         // Secondary accent
    textPrimary: string;     // Primary text color
    textSecondary: string;   // Secondary text color
}

// ============================================================================
// Main Hook
// ============================================================================

export function useImageColors(imageUrl: string | null | undefined): DynamicColors {
    const [extractedColors, setExtractedColors] = useState<RGB[]>([]);

    useEffect(() => {
        if (!imageUrl) {
            setExtractedColors([]);
            return;
        }

        const img = new Image();
        img.src = imageUrl;

        let active = true;

        img.onload = () => {
            if (!active) return;
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Resize for faster processing
                canvas.width = 64;
                canvas.height = 64;

                ctx.drawImage(img, 0, 0, 64, 64);
                const imageData = ctx.getImageData(0, 0, 64, 64).data;

                // Extract colors using k-means-like clustering
                const colorMap = new Map<string, { rgb: RGB; count: number }>();

                // Sample pixels (skip some for performance)
                for (let i = 0; i < imageData.length; i += 16) { // Every 4th pixel
                    const r = imageData[i];
                    const g = imageData[i + 1];
                    const b = imageData[i + 2];

                    // Skip very dark or very light colors
                    const brightness = (r + g + b) / 3;
                    if (brightness < 20 || brightness > 240) continue;

                    // Quantize to reduce similar colors
                    const qr = Math.round(r / 32) * 32;
                    const qg = Math.round(g / 32) * 32;
                    const qb = Math.round(b / 32) * 32;
                    const key = `${qr},${qg},${qb}`;

                    if (colorMap.has(key)) {
                        const entry = colorMap.get(key)!;
                        entry.count++;
                        // Accumulate for average
                        entry.rgb.r = (entry.rgb.r * (entry.count - 1) + r) / entry.count;
                        entry.rgb.g = (entry.rgb.g * (entry.count - 1) + g) / entry.count;
                        entry.rgb.b = (entry.rgb.b * (entry.count - 1) + b) / entry.count;
                    } else {
                        colorMap.set(key, { rgb: { r, g, b }, count: 1 });
                    }
                }

                // Sort by frequency and get top colors
                const sorted = Array.from(colorMap.values())
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)
                    .map(entry => entry.rgb);

                setExtractedColors(sorted);

            } catch (e) {
                console.error('Failed to extract colors', e);
                setExtractedColors([]);
            }
        };

        img.onerror = () => {
            setExtractedColors([]);
        };

        return () => {
            active = false;
            img.onload = null;
            img.onerror = null;
        };
    }, [imageUrl]);

    // Compute dynamic colors from extracted palette
    const dynamicColors = useMemo<DynamicColors>(() => {
        if (extractedColors.length === 0) {
            return {
                background: DEFAULT_DARK,
                backgroundRaw: DEFAULT_DARK,
                accent1: DEFAULT_ACCENT,
                accent2: '#8b5cf6', // Purple
                textPrimary: DEFAULT_LIGHT,
                textSecondary: 'rgba(255, 255, 255, 0.6)'
            };
        }

        // Find dominant color (most frequent, with preference for vibrant colors)
        let dominantIndex = 0;
        let maxScore = 0;
        extractedColors.forEach((rgb, i) => {
            const vibrancy = getVibrancy(rgb);
            const score = (extractedColors.length - i) + vibrancy * 5; // Frequency + vibrancy bonus
            if (score > maxScore) {
                maxScore = score;
                dominantIndex = i;
            }
        });

        const dominant = extractedColors[dominantIndex];

        // Create darkened background
        const darkened = darkenColor(dominant, 0.7); // 70% darker
        const background = rgbToString(darkened);
        const backgroundRaw = rgbToString(dominant);

        // Find accent1: best contrast with darkened background
        let accent1 = extractedColors[0];
        let bestContrast = 0;

        for (const color of extractedColors) {
            // Prefer vibrant colors for accent
            const vibrancy = getVibrancy(color);
            if (vibrancy < 0.2) continue; // Skip grayish colors

            const contrast = getContrastRatio(color, darkened);
            // Weight by vibrancy
            const score = contrast * (1 + vibrancy);

            if (score > bestContrast) {
                bestContrast = score;
                accent1 = color;
            }
        }

        // If contrast is still too low, lighten the accent
        if (getContrastRatio(accent1, darkened) < 3) {
            accent1 = lightenColor(accent1, 0.4);
        }

        // Further saturate accent1 for pop
        accent1 = saturateColor(accent1, 0.3);

        // Find accent2: different from accent1, still good contrast
        let accent2 = extractedColors[1] || extractedColors[0];
        let bestDiff = 0;

        for (const color of extractedColors) {
            if (color === accent1) continue;

            const diffFromAccent1 = Math.abs(getLuminance(color) - getLuminance(accent1)) +
                Math.abs(color.r - accent1.r) / 255 +
                Math.abs(color.g - accent1.g) / 255 +
                Math.abs(color.b - accent1.b) / 255;

            const contrast = getContrastRatio(color, darkened);

            if (diffFromAccent1 > 0.3 && contrast > 2 && diffFromAccent1 > bestDiff) {
                bestDiff = diffFromAccent1;
                accent2 = color;
            }
        }

        // Ensure accent2 has decent contrast
        if (getContrastRatio(accent2, darkened) < 2.5) {
            accent2 = lightenColor(accent2, 0.3);
        }

        return {
            background,
            backgroundRaw,
            accent1: rgbToString(accent1),
            accent2: rgbToString(accent2),
            textPrimary: DEFAULT_LIGHT,
            textSecondary: 'rgba(255, 255, 255, 0.6)'
        };
    }, [extractedColors]);

    return dynamicColors;
}

// Legacy export for compatibility
export function useLegacyImageColors(imageUrl: string | null | undefined) {
    const dynamicColors = useImageColors(imageUrl);
    return {
        colors: [dynamicColors.backgroundRaw, dynamicColors.accent1, dynamicColors.accent2].filter(Boolean),
        dominantColor: dynamicColors.backgroundRaw
    };
}
