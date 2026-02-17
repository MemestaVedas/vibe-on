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

// Default Fallback (Signal Orange / Technical Brutalist)
const DEFAULT_THEME: ThemeColors = {
    primary: '#ff5c00', // Signal Orange
    onPrimary: '#000000',
    primaryContainer: '#cc4a00',
    onPrimaryContainer: '#ffffff',

    secondary: '#00ff41', // Signal Green
    onSecondary: '#000000',
    secondaryContainer: '#008f11',
    onSecondaryContainer: '#ffffff',

    tertiary: '#ffff00', // High-Vis Yellow
    onTertiary: '#000000',
    tertiaryContainer: '#cccc00',
    onTertiaryContainer: '#000000',

    surface: '#0a0a0c',
    onSurface: '#fdfdfd',
    surfaceVariant: '#24242b',
    onSurfaceVariant: '#555555',

    surfaceContainerLowest: '#030303',
    surfaceContainerLow: '#111114',
    surfaceContainer: '#16161a',
    surfaceContainerHigh: '#1c1c21',
    surfaceContainerHighest: '#24242b',

    outline: '#555555',
    outlineVariant: '#222222',

    sourceColor: '#ff5c00'
};

export const useThemeStore = create<ThemeStore>((set) => ({
    colors: DEFAULT_THEME,
    displayLanguage: 'romaji',
    setColors: (colors) => set({ colors }),
    setDisplayLanguage: (lang) => set({ displayLanguage: lang }),
}));
