import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrackDisplay } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { usePlaylistStore } from '../store/playlistStore';
import { IconHeart, IconNext, IconPlus, IconQueue } from './Icons';

interface ContextMenuProps {
    x: number;
    y: number;
    track: TrackDisplay;
    onClose: () => void;
}

export function ContextMenu({ x, y, track, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const { playNext, addToQueue, toggleFavorite, isFavorite } = usePlayerStore();
    const { playlists, addTrackToPlaylist, fetchPlaylists } = usePlaylistStore();
    const [view, setView] = useState<'main' | 'playlists'>('main');

    const [position, setPosition] = useState<{ top?: number, bottom?: number, left: number }>({ top: y, left: x });

    useEffect(() => {
        if (menuRef.current) {
            const menuHeight = menuRef.current.offsetHeight || 300; // Approximate if not yet rendered, but ref should help
            const windowHeight = window.innerHeight;

            // If clicking in the bottom 40% of the screen, show menu ABOVE the cursor
            // Or if menu would overflow bottom
            if (y > windowHeight * 0.6 || (y + menuHeight > windowHeight)) {
                setPosition({
                    bottom: windowHeight - y,
                    left: x
                });
            } else {
                setPosition({
                    top: y,
                    left: x
                });
            }
        }
    }, [x, y]);

    useEffect(() => {
        // Fetch playlists when menu opens to ensure up-to-date list
        fetchPlaylists();

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            // Provide a way for containers (like auto-scrolling lyrics) to NOT close the context menu
            if (target?.classList?.contains('ignore-context-close')) return;
            onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [onClose]);

    const handleAction = (action: () => void) => {
        action();
        onClose();
    };

    const handleAddToPlaylist = async (playlistId: string) => {
        await addTrackToPlaylist(playlistId, track.path);
        onClose();
    };

    return (
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.9, y: position.bottom ? 10 : -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: position.bottom ? 10 : -10 }}
                transition={{ duration: 0.1 }}
                style={{
                    position: 'fixed',
                    left: position.left,
                    top: position.top,
                    bottom: position.bottom,
                    transformOrigin: position.bottom ? 'bottom left' : 'top left'
                }}
                className="fixed z-[9999] min-w-[220px] max-w-[260px] bg-surface-container-high border border-outline-variant/20 rounded-xl shadow-elevation-3 py-2 flex flex-col overflow-hidden"
            >
                {view === 'main' ? (
                    <>
                        <div className="px-4 py-2 border-b border-outline-variant/10 mb-1">
                            <div className="text-label-medium font-bold text-on-surface truncate">{track.title}</div>
                            <div className="text-label-small text-on-surface-variant truncate">{track.artist}</div>
                        </div>

                        <button
                            onClick={() => handleAction(() => playNext(track))}
                            className="flex items-center gap-3 px-4 py-3 text-label-large text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                        >
                            <IconNext size={20} className="text-on-surface-variant" />
                            Play Next
                        </button>

                        <button
                            onClick={() => handleAction(() => addToQueue(track))}
                            className="flex items-center gap-3 px-4 py-3 text-label-large text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                        >
                            <IconQueue size={20} className="text-on-surface-variant" />
                            Add to Queue
                        </button>

                        <div className="my-1 border-t border-outline-variant/10" />

                        <button
                            onClick={() => setView('playlists')}
                            className="flex items-center gap-3 px-4 py-3 text-label-large text-on-surface hover:bg-surface-container-highest transition-colors text-left w-full justify-between group"
                        >
                            <span className="flex items-center gap-3">
                                <IconPlus size={20} className="text-on-surface-variant" />
                                Add to Playlist
                            </span>
                            <IconNext size={16} className="text-on-surface-variant/50 group-hover:text-on-surface-variant" />
                        </button>

                        <div className="my-1 border-t border-outline-variant/10" />

                        <button
                            onClick={() => handleAction(() => toggleFavorite(track.path))}
                            className="flex items-center gap-3 px-4 py-3 text-label-large text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                        >
                            <IconHeart size={20} filled={isFavorite(track.path)} className={isFavorite(track.path) ? "text-error" : "text-on-surface-variant"} />
                            {isFavorite(track.path) ? "Remove from Favorites" : "Favorite"}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="px-2 py-2 border-b border-outline-variant/10 mb-1 flex items-center gap-2">
                            <button
                                onClick={() => setView('main')}
                                className="p-1 hover:bg-surface-container-highest rounded-full text-on-surface-variant"
                            >
                                <IconNext size={20} className="rotate-180" />
                            </button>
                            <span className="text-label-large font-bold text-on-surface">Select Playlist</span>
                        </div>
                        <div className="max-h-[200px] overflow-y-auto overflow-x-hidden">
                            {playlists.map(playlist => (
                                <button
                                    key={playlist.id}
                                    onClick={() => handleAddToPlaylist(playlist.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-label-large text-on-surface hover:bg-surface-container-highest transition-colors text-left truncate"
                                >
                                    <span className="truncate">{playlist.name}</span>
                                </button>
                            ))}
                            <button
                                onClick={() => {
                                    usePlaylistStore.getState().openCreateDialog(track.path);
                                    onClose();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-label-large text-primary hover:bg-surface-container-highest transition-colors text-left font-medium border-t border-outline-variant/10"
                            >
                                <IconPlus size={20} />
                                New Playlist...
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
