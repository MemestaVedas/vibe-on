import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AlbumArtStyle = 'vinyl' | 'full';

interface SettingsStore {
    // Player appearance
    albumArtStyle: AlbumArtStyle;

    // Actions
    setAlbumArtStyle: (style: AlbumArtStyle) => void;
}

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            // Default settings
            albumArtStyle: 'vinyl',

            // Actions
            setAlbumArtStyle: (style) => set({ albumArtStyle: style }),
        }),
        {
            name: 'vibe-settings', // localStorage key
        }
    )
);
