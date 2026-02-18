import { useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useThemeStore } from '../store/themeStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { motion } from 'framer-motion';
import { ContextMenu } from './ContextMenu';
import type { TrackDisplay } from '../types';
import { getDisplayText } from '../utils/textUtils';

// ============================================================================
// Icons
// ============================================================================

function IconHeart({ size = 24, filled = false }: { size?: number; filled?: boolean }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
    );
}

function IconPlay({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
        </svg>
    );
}

// ============================================================================
// Components
// ============================================================================

interface FavoriteTrackRowProps {
    track: TrackDisplay;
    onPlay: () => void;
    onRemove: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    displayLanguage: 'original' | 'romaji' | 'en';
}

function FavoriteTrackRow({ track, onPlay, onRemove, onContextMenu, displayLanguage }: FavoriteTrackRowProps) {
    const coverArt = useCoverArt(track.cover_image, track.path);
    const displayTitle = getDisplayText(track, 'title', displayLanguage);
    const displayArtist = getDisplayText(track, 'artist', displayLanguage);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-surface-container-highest transition-colors cursor-pointer"
            onClick={onPlay}
            onContextMenu={onContextMenu}
        >
            {/* Cover Art */}
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container-high flex-shrink-0">
                {coverArt ? (
                    <img src={coverArt} alt={track.album} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-on-surface-variant/50">
                        ♪
                    </div>
                )}
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0">
                <p className="text-body-large font-medium text-on-surface truncate">{displayTitle}</p>
                <p className="text-body-medium text-on-surface-variant truncate">{displayArtist}</p>
            </div>

            {/* Duration */}
            <span className="text-body-medium text-on-surface-variant tabular-nums">
                {formatTime(track.duration_secs)}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlay();
                    }}
                    className="p-2 rounded-full bg-primary text-on-primary hover:bg-primary/90 transition-colors"
                >
                    <IconPlay size={16} />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="p-2 rounded-full bg-error-container text-on-error-container hover:bg-error/20 transition-colors"
                    title="Remove from Favorites"
                >
                    <IconHeart size={16} filled />
                </button>
            </div>
        </motion.div>
    );
}

export function FavoritesView() {
    const { library, favorites, toggleFavorite, playFile, displayLanguage } = usePlayerStore();
    const { colors } = useThemeStore();
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: TrackDisplay } | null>(null);

    // Get favorite tracks from library
    const favoriteTracks = library.filter(track => favorites.has(track.path));

    const handleContextMenu = (e: React.MouseEvent, track: any) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            track: track as TrackDisplay
        });
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-on-primary-container"
                        style={{ backgroundColor: colors.primaryContainer }}
                    >
                        <IconHeart size={28} filled />
                    </div>
                    <div>
                        <h1 className="text-headline-medium font-bold text-on-surface">Favorites</h1>
                        <p className="text-body-medium text-on-surface-variant">
                            {favoriteTracks.length} {favoriteTracks.length === 1 ? 'song' : 'songs'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Track List */}
            <div className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
                {favoriteTracks.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        {favoriteTracks.map((track) => (
                            <FavoriteTrackRow
                                key={track.path}
                                track={track}
                                onPlay={() => playFile(track.path)}
                                onRemove={() => toggleFavorite(track.path)}
                                onContextMenu={(e) => handleContextMenu(e, track)}
                                displayLanguage={displayLanguage as 'original' | 'romaji' | 'en'}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-16">
                        <div className="w-24 h-24 rounded-full bg-surface-container-highest flex items-center justify-center mb-4">
                            <IconHeart size={48} />
                        </div>
                        <h2 className="text-title-large font-medium text-on-surface mb-2">No Favorites Yet</h2>
                        <p className="text-body-medium text-on-surface-variant max-w-xs">
                            Click the heart icon on any song to add it to your favorites.
                        </p>
                    </div>
                )}
            </div>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    track={contextMenu.track}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
}
