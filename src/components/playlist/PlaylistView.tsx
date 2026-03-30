import { useEffect, memo, useState } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import { useNavigationStore } from '@/store/navigationStore';
import { usePlayerStore } from '@/store/playerStore';
import { useToastStore } from '@/store/toastStore';
import { IconAlbum, IconHeart, IconMusicNote, IconPlay, IconTrash } from '@/components/common/Icons';
import { WavySeparator } from '@/components/common/WavySeparator';
import { M3CircleImage, M3SquircleImage } from '@/components/common/ShapeComponents';
import { Virtuoso } from 'react-virtuoso';
import { useCoverArt } from '@/hooks/useCoverArt';
import { getDisplayText } from '@/utils/textUtils';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PlaylistTrack, TrackDisplay } from '@/types';

function androidColorIntToCss(color?: number | null): string | undefined {
    if (typeof color !== 'number') return undefined;
    const hex = (color >>> 0).toString(16).padStart(8, '0');
    return `#${hex.slice(2)}`;
}

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const PlaylistTrackRow = memo(function PlaylistTrackRow({ track, index, isActive, isPlaying, onClick, onRemove }: {
    track: PlaylistTrack,
    index: number,
    isActive: boolean,
    isPlaying: boolean,
    onClick: () => void,
    onRemove: (e: React.MouseEvent) => void
}) {
    const coverUrl = useCoverArt(track.cover_image, track.path);
    const displayLanguage = usePlayerStore(state => state.displayLanguage);

    const displayTitle = getDisplayText(track, 'title', displayLanguage);
    const displayArtist = getDisplayText(track, 'artist', displayLanguage);
    const displayAlbum = getDisplayText(track, 'album', displayLanguage);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: track.playlist_track_id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            onClick={onClick}
            className={`
                group grid grid-cols-[2rem_3rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_4rem_4rem] gap-4 items-center 
                px-4 py-3 mx-2 rounded-xl cursor-pointer transition-all duration-200
                ${isActive
                    ? 'bg-secondary-container/10 text-primary'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/50'
                }
                ${isDragging ? 'shadow-lg z-50' : ''}
            `}
        >
            <span {...listeners} className="cursor-grab active:cursor-grabbing flex justify-center text-on-surface-variant/50 hover:text-primary transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 3h2v2H9V3zm4 0h2v2h-2V3zM9 7h2v2H9V7zm4 0h2v2h-2V7zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2z" />
                </svg>
            </span>
            <span className="flex justify-center font-medium relative w-8">
                {isActive && isPlaying ? (
                    <IconPlay size={16} fill="currentColor" />
                ) : (
                    <span className="group-hover:hidden text-label-medium">{index + 1}</span>
                )}
                <span className="hidden group-hover:flex absolute inset-0 items-center justify-center text-primary">
                    <IconPlay size={20} fill="currentColor" />
                </span>
            </span>

            <span className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 shrink-0">
                    {coverUrl ? (
                        <M3CircleImage src={coverUrl} fallback={<IconMusicNote size={16} />} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-container-high/50 rounded-full">
                            <IconMusicNote size={16} />
                        </div>
                    )}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className={`truncate font-medium text-body-large ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                        {displayTitle}
                    </span>
                    <span className="truncate text-body-small opacity-70 lg:hidden">{displayArtist}</span>
                </div>
            </span>

            <span className="truncate text-body-medium opacity-80 hidden lg:block">{displayArtist}</span>
            <span className="truncate text-body-medium opacity-80 hidden xl:block">{displayAlbum}</span>

            <span className="text-right text-label-medium tabular-nums opacity-60">
                {formatDuration(track.duration_secs)}
            </span>

            <button
                onClick={onRemove}
                className="p-2 rounded-full hover:bg-error/10 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all justify-self-end"
                title="Remove from Playlist"
            >
                <IconTrash size={18} />
            </button>
        </div>
    );
});

export function PlaylistView() {
    const { activePlaylistId, setView } = useNavigationStore();
    const {
        playlists,
        currentPlaylistTracks,
        fetchPlaylistTracks,
        removeTrackFromPlaylist,
        renamePlaylist,
        deletePlaylist,
        reorderPlaylistTracks,
        isFetchingTracks,
        isMutatingPlaylist,
        isReorderingTracks,
        error,
        clearError,
    } = usePlaylistStore();
    const { playQueue, status } = usePlayerStore();
    const showToast = useToastStore(s => s.showToast);
    const [localTracks, setLocalTracks] = useState<PlaylistTrack[]>([]);
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Find current playlist object
    const playlist = playlists.find(p => p.id === activePlaylistId);

    // Setup drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (activePlaylistId) {
            fetchPlaylistTracks(activePlaylistId);
        }
    }, [activePlaylistId]);

    // Sync local tracks with store
    useEffect(() => {
        setLocalTracks(currentPlaylistTracks);
    }, [currentPlaylistTracks]);

    useEffect(() => {
        if (!error) return;
        showToast(error);
        clearError();
    }, [error, showToast, clearError]);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id && playlist) {
            const previousOrder = [...localTracks];
            const oldIndex = localTracks.findIndex((track) => track.playlist_track_id === active.id);
            const newIndex = localTracks.findIndex((track) => track.playlist_track_id === over.id);

            const newOrder = arrayMove(localTracks, oldIndex, newIndex);
            setLocalTracks(newOrder);

            // Persist to backend
            const trackIds = newOrder.map(t => t.playlist_track_id);
            const success = await reorderPlaylistTracks(playlist.id, trackIds);
            if (!success) {
                setLocalTracks(previousOrder);
                showToast('Could not save track order. Restored previous order.');
                return;
            }

            showToast('Playlist order updated');
        }
    };

    if (!playlist) {
        return <div className="p-8 text-center text-on-surface-variant">Playlist not found</div>;
    }

    const openRenameDialog = () => {
        setRenameValue(playlist.name);
        setIsRenameDialogOpen(true);
    };

    const handleRename = async () => {
        if (!renameValue.trim() || renameValue.trim() === playlist.name) {
            setIsRenameDialogOpen(false);
            return;
        }

        const success = await renamePlaylist(playlist.id, renameValue);
        if (success) {
            showToast('Playlist renamed');
        }
        setIsRenameDialogOpen(false);
    };

    const handleDelete = async () => {
        const success = await deletePlaylist(playlist.id);
        if (success) {
            showToast('Playlist deleted');
            setIsDeleteDialogOpen(false);
            setView('tracks'); // Go back to tracks
        }
    };

    const handlePlayPlaylist = (index: number) => {
        // We need to play the playlist queue
        // playQueue expects a list of tracks and an index.
        const queueTracks: TrackDisplay[] = localTracks.map(t => ({
            ...t,
            id: t.path,
            // Ensure other optional fields from TrackDisplay are present if needed, but strict minimal is id
        }));
        playQueue(queueTracks, index);
    };

    const playlistColor = androidColorIntToCss(playlist?.color);
    const isIconMode = playlist?.customization_type?.toLowerCase() === 'icon';
    const isImageMode = playlist?.customization_type?.toLowerCase() === 'image' && !!playlist?.image_uri;

    const playlistIcon = (() => {
        switch (playlist?.icon_name) {
            case 'Heart':
            case 'Favorite':
                return <IconHeart size={48} filled className="text-white" />;
            case 'Album':
                return <IconAlbum size={48} className="text-white" />;
            default:
                return <IconMusicNote size={48} className={isIconMode ? 'text-white' : 'text-on-secondary-container'} />;
        }
    })();

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Header */}
            <div className="px-8 py-6 flex items-end justify-between bg-surface-container-low/50">
                <div className="flex items-center gap-6">
                    <div className="w-32 h-32 shadow-lg">
                        {isImageMode ? (
                            <M3SquircleImage src={playlist?.image_uri ?? null} fallback={playlistIcon} />
                        ) : (
                            <div
                                className="w-full h-full rounded-[28px] flex items-center justify-center"
                                style={{
                                    backgroundColor: isIconMode
                                        ? (playlistColor ?? 'var(--md-sys-color-primary)')
                                        : 'var(--md-sys-color-secondary-container)',
                                }}
                            >
                                {playlistIcon}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-label-medium text-on-surface-variant uppercase tracking-wider">Playlist</span>
                        <h1
                            className="text-display-small font-bold text-on-surface cursor-pointer hover:underline decoration-on-surface/20"
                            onClick={openRenameDialog}
                            title="Click to rename"
                        >
                            {playlist.name}
                        </h1>
                        <span className="text-body-medium text-on-surface-variant opacity-80">
                            {localTracks.length} songs
                        </span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => handlePlayPlaylist(0)}
                        className="px-6 py-2.5 bg-primary text-on-primary rounded-full hover:bg-primary/90 font-medium shadow-md flex items-center gap-2 transition-transform active:scale-95"
                        disabled={localTracks.length === 0}
                    >
                        <IconPlay size={20} fill="currentColor" /> Play
                    </button>
                    <button
                        onClick={() => setIsDeleteDialogOpen(true)}
                        className="p-2.5 rounded-full hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                        title="Delete Playlist"
                        disabled={isMutatingPlaylist}
                    >
                        <IconTrash size={24} />
                    </button>
                </div>
            </div>

            <div className="px-6">
                <WavySeparator label="" color="var(--md-sys-color-outline-variant)" />
            </div>

            {/* List */}
            <div className="flex-1">
                {isFetchingTracks ? (
                    <div className="flex justify-center p-8 text-on-surface-variant animate-pulse">Loading tracks...</div>
                ) : localTracks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant/60 gap-4">
                        <IconMusicNote size={48} />
                        <p>No tracks in this playlist yet.</p>
                    </div>
                ) : (
                    <div className="h-full relative">
                        {isReorderingTracks && (
                            <div className="absolute top-3 right-6 z-10 text-label-small text-on-surface-variant bg-surface-container-high/90 px-3 py-1 rounded-full shadow-sm">
                                Saving order...
                            </div>
                        )}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={localTracks.map(t => t.playlist_track_id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <Virtuoso
                                style={{ height: '100%' }}
                                data={localTracks}
                                itemContent={(index, track) => (
                                    <PlaylistTrackRow
                                        key={`${track.path}-${index}`}
                                        track={track}
                                        index={index}
                                        isActive={status.track?.path === track.path}
                                        isPlaying={status.state === 'Playing'}
                                        onClick={() => handlePlayPlaylist(index)}
                                        onRemove={(e) => {
                                            e.stopPropagation();
                                            removeTrackFromPlaylist(playlist.id, track.playlist_track_id);
                                        }}
                                    />
                                )}
                                components={{
                                    Footer: () => <div className="h-32"></div>
                                }}
                            />
                        </SortableContext>
                    </DndContext>
                    </div>
                )}
            </div>

            {isRenameDialogOpen && (
                <div className="fixed inset-0 z-10000 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setIsRenameDialogOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-surface-container p-6 shadow-elevation-4 border border-outline-variant/20">
                        <h2 className="text-title-large font-semibold text-on-surface">Rename Playlist</h2>
                        <p className="text-body-medium text-on-surface-variant mt-1">Pick a new name for this playlist.</p>

                        <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="mt-4 w-full h-12 px-4 rounded-xl bg-surface-container-highest text-on-surface border border-outline-variant/30 outline-hidden focus:ring-2 focus:ring-primary/30"
                            placeholder="Playlist name"
                            autoFocus
                        />

                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                onClick={() => setIsRenameDialogOpen(false)}
                                className="h-10 px-4 rounded-full text-primary hover:bg-primary/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRename}
                                disabled={isMutatingPlaylist || !renameValue.trim()}
                                className="h-10 px-4 rounded-full bg-primary text-on-primary disabled:opacity-50"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteDialogOpen && (
                <div className="fixed inset-0 z-10000 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setIsDeleteDialogOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-surface-container p-6 shadow-elevation-4 border border-outline-variant/20">
                        <h2 className="text-title-large font-semibold text-on-surface">Delete Playlist</h2>
                        <p className="text-body-medium text-on-surface-variant mt-1">
                            Delete "{playlist.name}"? This cannot be undone.
                        </p>

                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                onClick={() => setIsDeleteDialogOpen(false)}
                                className="h-10 px-4 rounded-full text-primary hover:bg-primary/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isMutatingPlaylist}
                                className="h-10 px-4 rounded-full bg-error text-on-error disabled:opacity-50"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
