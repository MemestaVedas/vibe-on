import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AlbumArtStyle = 'vinyl' | 'full';
export type ExpandedArtMode = 'background' | 'pill';

interface SettingsStore {
    // Player appearance
    albumArtStyle: AlbumArtStyle;
    expandedArtMode: ExpandedArtMode;

    // Actions
    setAlbumArtStyle: (style: AlbumArtStyle) => void;
    setExpandedArtMode: (mode: ExpandedArtMode) => void;
}

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            // Default settings
            albumArtStyle: 'vinyl',
            expandedArtMode: 'background',

            // Actions
            setAlbumArtStyle: (style) => set({ albumArtStyle: style }),
            setExpandedArtMode: (mode) => set({ expandedArtMode: mode }),
        }),
        {
            name: 'vibe-settings', // localStorage key
        }
    )
);
