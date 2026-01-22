import { useState, useEffect, useMemo } from 'react';

// ============================================================================
// Color Utility Functions
// ============================================================================

interface RGB {
    r: number;
    g: number;
    b: number;
}

// Convert RGB to string
function rgbToString(rgb: RGB): string {
    return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
}

// Convert RGB to RGBA string
function rgbToRgba(rgb: RGB, alpha: number): string {
    return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`;
}

// ============================================================================
// Default Colors
// ============================================================================

// const DEFAULT_DARK = '#0a0a0f';
// const DEFAULT_LIGHT = '#f5f5f5';
// const DEFAULT_ACCENT = '#6366f1';

export interface DynamicColors {
    background: string;
    backgroundRaw: string;
    accent1: string;
    accent1Foreground: string;
    accent2: string;
    textPrimary: string;
    textSecondary: string;
}

// ============================================================================
// Main Hook
// ============================================================================

interface HSL { h: number; s: number; l: number; }

function rgbToHsl(r: number, g: number, b: number): HSL {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number): RGB {
    let r, g, b;
    if (s === 0) { r = g = b = l; } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        r = hue2rgb(p, q, h / 360 + 1 / 3); g = hue2rgb(p, q, h / 360); b = hue2rgb(p, q, h / 360 - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function getToneColor(hsl: HSL, tone: number): RGB {
    let newS = hsl.s;
    if (tone < 10) newS *= 0.5;
    return hslToRgb(hsl.h, newS, tone / 100);
}

function getTone(hsl: HSL, tone: number): string {
    return rgbToString(getToneColor(hsl, tone));
}

export function useImageColors(imageUrl: string | null | undefined): DynamicColors {
    const [palette, setPalette] = useState<{ abundant: RGB, vibrant: RGB } | null>(null);

    useEffect(() => {
        if (!imageUrl) { setPalette(null); return; }
        const img = new Image();
        img.src = imageUrl;
        img.crossOrigin = "Anonymous";
        let active = true;

        img.onload = () => {
            if (!active) return;
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                canvas.width = 64; canvas.height = 64;
                ctx.drawImage(img, 0, 0, 64, 64);
                const data = ctx.getImageData(0, 0, 64, 64).data;

                const counts = new Map<string, { rgb: RGB, count: number }>();
                for (let i = 0; i < data.length; i += 16) {
                    if (data[i + 3] < 128) continue;
                    // Quantize (5 bits per channel)
                    const qr = data[i] >> 3, qg = data[i + 1] >> 3, qb = data[i + 2] >> 3;
                    const key = `${qr},${qg},${qb}`;
                    const entry = counts.get(key) || { rgb: { r: data[i], g: data[i + 1], b: data[i + 2] }, count: 0 };
                    entry.count++;
                    counts.set(key, entry);
                }

                const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count);
                if (sorted.length === 0) return;

                // 1. Abundant: Most common color that isn't too light/dark if possible
                let abundant = sorted[0].rgb;
                // Try to skip pure whites/blacks for abundance if there's a good color alternative
                for (const entry of sorted.slice(0, 5)) {
                    const h = rgbToHsl(entry.rgb.r, entry.rgb.g, entry.rgb.b);
                    if (h.s > 0.05 && h.l > 0.1 && h.l < 0.9) {
                        abundant = entry.rgb;
                        break;
                    }
                }

                // 2. Vibrant: Best chroma from top candidates
                let vibrant = abundant;
                let maxVibe = 0;
                for (const entry of sorted.slice(0, 20)) {
                    const hsl = rgbToHsl(entry.rgb.r, entry.rgb.g, entry.rgb.b);
                    const score = hsl.s * (1 - Math.abs(hsl.l - 0.5) * 2);
                    if (score > maxVibe) { maxVibe = score; vibrant = entry.rgb; }
                }

                setPalette({ abundant, vibrant });
            } catch (e) {
                console.error(e);
                setPalette(null);
            }
        };
        img.onerror = () => setPalette(null);
        return () => { active = false; };
    }, [imageUrl]);

    const dynamicColors = useMemo<DynamicColors>(() => {
        const pal = palette || {
            abundant: { r: 99, g: 102, b: 241 },
            vibrant: { r: 99, g: 102, b: 241 }
        };

        const abundantHSL = rgbToHsl(pal.abundant.r, pal.abundant.g, pal.abundant.b);
        const vibrantHSL = rgbToHsl(pal.vibrant.r, pal.vibrant.g, pal.vibrant.b);

        return {
            background: getTone(abundantHSL, 6),
            backgroundRaw: rgbToRgba(getToneColor(abundantHSL, 12), 0.9), // Slightly darker, 90% opaque
            accent1: getTone(vibrantHSL, 80),
            accent1Foreground: getTone(vibrantHSL, 20),
            accent2: getTone(vibrantHSL, 70),
            textPrimary: '#f1f1f1',
            textSecondary: 'rgba(255, 255, 255, 0.7)'
        };
    }, [palette]);

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
