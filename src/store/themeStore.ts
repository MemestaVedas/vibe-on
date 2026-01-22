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
    setColors: (colors: ThemeColors) => void;
}

// Default Fallback (Approximate Indigo/Violet Theme)
const DEFAULT_THEME: ThemeColors = {
    primary: '#bfc2ff',
    onPrimary: '#1f225e',
    primaryContainer: '#353975',
    onPrimaryContainer: '#e0e0ff',

    secondary: '#c6bfff',
    onSecondary: '#29215c',
    secondaryContainer: '#403974',
    onSecondaryContainer: '#e4dfff',

    tertiary: '#ffb0cd',
    onTertiary: '#5e1135',
    tertiaryContainer: '#7b294e',
    onTertiaryContainer: '#ffd8e4',

    surface: '#121216',
    onSurface: '#e4e1e6',
    surfaceVariant: '#46464f',
    onSurfaceVariant: '#c7c5d0',

    surfaceContainerLowest: '#0d0d11',
    surfaceContainerLow: '#1a1a1f',
    surfaceContainer: '#1e1e24',
    surfaceContainerHigh: '#282830',
    surfaceContainerHighest: '#33333f',

    outline: '#918f9a',
    outlineVariant: '#46464f',

    sourceColor: '#6366f1'
};

export const useThemeStore = create<ThemeStore>((set) => ({
    colors: DEFAULT_THEME,
    setColors: (colors) => set({ colors }),
}));
