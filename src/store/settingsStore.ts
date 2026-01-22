import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AlbumArtStyle = 'vinyl' | 'full';
export type ExpandedArtMode = 'background' | 'pill';

interface SettingsStore {
    // Player appearance
    albumArtStyle: AlbumArtStyle;
    expandedArtMode: ExpandedArtMode;

    // Playback
    autoplay: boolean;

    // Actions
    setAlbumArtStyle: (style: AlbumArtStyle) => void;
    setExpandedArtMode: (mode: ExpandedArtMode) => void;
    setAutoplay: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            // Default settings
            albumArtStyle: 'vinyl',
            expandedArtMode: 'background',
            autoplay: true,

            // Actions
            setAlbumArtStyle: (style) => set({ albumArtStyle: style }),
            setExpandedArtMode: (mode) => set({ expandedArtMode: mode }),
            setAutoplay: (enabled) => set({ autoplay: enabled }),
        }),
        {
            name: 'vibe-settings', // localStorage key
        }
    )
);
