import { create } from 'zustand';

export interface ThemeColors {
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

    // Surface Containers (New M3)
    surfaceContainerLowest: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;

    // Utility
    outline: string;
    outlineVariant: string;

    sourceColor: string;
}

interface ThemeStore {
    colors: ThemeColors;
    displayLanguage: 'original' | 'romaji' | 'en';
    setColors: (colors: ThemeColors) => void;
    setDisplayLanguage: (lang: 'original' | 'romaji' | 'en') => void;
}

// Default fallback aligned with shared Material 3 expressive dark palette.
const DEFAULT_THEME: ThemeColors = {
    primary: '#d0bcff',
    onPrimary: '#381e72',
    primaryContainer: '#4f378b',
    onPrimaryContainer: '#eaddff',

    secondary: '#ccc2dc',
    onSecondary: '#332d41',
    secondaryContainer: '#4a4458',
    onSecondaryContainer: '#e8def8',

    tertiary: '#efb8c8',
    onTertiary: '#492532',
    tertiaryContainer: '#633b48',
    onTertiaryContainer: '#ffd8e4',

    surface: '#121214',
    onSurface: '#e6e1e5',
    surfaceVariant: '#49454f',
    onSurfaceVariant: '#cac4d0',

    surfaceContainerLowest: '#0f0f12',
    surfaceContainerLow: '#18181d',
    surfaceContainer: '#1e1e24',
    surfaceContainerHigh: '#25252d',
    surfaceContainerHighest: '#2f2f39',

    outline: '#938f99',
    outlineVariant: '#49454f',

    sourceColor: '#d0bcff'
};

export const useThemeStore = create<ThemeStore>((set) => ({
    colors: DEFAULT_THEME,
    displayLanguage: 'romaji',
    setColors: (colors) => set({ colors }),
    setDisplayLanguage: (lang) => set({ displayLanguage: lang }),
}));
