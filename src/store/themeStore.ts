import { create } from 'zustand';

export interface ThemeColors {
    background: string;
    backgroundRaw: string;
    accent1: string;
    accent1Foreground: string;
    accent2: string;
    textPrimary: string;
    textSecondary: string;
}

interface ThemeStore {
    colors: ThemeColors;
    setColors: (colors: ThemeColors) => void;
}

const DEFAULT_DARK = '#0a0a0f';
const DEFAULT_ACCENT = '#6366f1';
const DEFAULT_LIGHT = '#f5f5f5';

export const useThemeStore = create<ThemeStore>((set) => ({
    colors: {
        background: DEFAULT_DARK,
        backgroundRaw: DEFAULT_DARK,
        accent1: DEFAULT_ACCENT,
        accent1Foreground: '#ffffff',
        accent2: '#8b5cf6',
        textPrimary: DEFAULT_LIGHT,
        textSecondary: 'rgba(255, 255, 255, 0.6)',
    },
    setColors: (colors) => set({ colors }),
}));
