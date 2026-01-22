import { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { IconMusicNote, IconPlay } from './Icons';
import { WavySeparator } from './WavySeparator';
import type { TrackDisplay } from '../types';


// Format seconds to MM:SS
function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function TrackRow({ track, index, isActive, isPlaying, onClick }: {
    track: TrackDisplay,
    index: number,
    isActive: boolean,
    isPlaying: boolean,
    onClick: () => void
}) {
    const coverUrl = useCoverArt(track.cover_image);

    return (
        <div
            onClick={onClick}
            className={`
                group grid grid-cols-[3rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_4rem] gap-4 items-center 
                px-4 py-4 mx-2 rounded-xl cursor-pointer transition-colors
                ${isActive
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                }
            `}
        >
            <span className="flex justify-center font-medium">
                {isActive && isPlaying ? (
                    <IconPlay size={16} fill="currentColor" />
                ) : (
                    <span className="group-hover:hidden">{index + 1}</span>
                )}
                <span className="hidden group-hover:block text-primary">
                    <IconPlay size={16} fill="currentColor" />
                </span>
            </span>

            <span className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 shrink-0 rounded-md overflow-hidden bg-surface-container shadow-sm">
                    {coverUrl ? (
                        <img src={coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-container-high/50">
                            <IconMusicNote size={16} />
                        </div>
                    )}
                </div>
                <span className={`truncate font-medium ${isActive ? '' : 'text-on-surface'}`}>
                    {track.title}
                </span>
            </span>

            <span className="truncate text-body-medium opacity-80">{track.artist}</span>
            <span className="truncate text-body-medium opacity-80">{track.album}</span>
            <span className="text-right text-label-medium tabular-nums opacity-60">{formatDuration(track.duration_secs)}</span>
        </div>
    );
}

// Helper component for Sortable Headers
function SortHeader({ label, sortKey, align = 'left' }: { label: string, sortKey: keyof TrackDisplay, align?: 'left' | 'right' }) {
    const sort = usePlayerStore(state => state.sort);
    const setSort = usePlayerStore(state => state.setSort);
    const isActive = sort?.key === sortKey;

    return (
        <div
            onClick={() => setSort(sortKey)}
            className={`
                flex items-center gap-1 cursor-pointer hover:text-on-surface transition-colors select-none py-3 text-label-large font-medium
                ${align === 'right' ? 'justify-end' : 'justify-start'}
                ${isActive ? 'text-primary' : 'text-on-surface-variant'}
            `}
        >
            {label}
            {isActive && (
                <span className="text-[0.7rem]">
                    {sort?.direction === 'asc' ? '▲' : '▼'}
                </span>
            )}
        </div>
    );
}

export function TrackList() {
    const library = usePlayerStore(state => state.library);
    const playFile = usePlayerStore(state => state.playFile);
    const isLoading = usePlayerStore(state => state.isLoading);
    const currentPath = usePlayerStore(state => state.status.track?.path);
    const isPlaying = usePlayerStore(state => state.status.state === 'Playing');
    const searchQuery = usePlayerStore(state => state.searchQuery);

    // Filter library based on search query
    const filteredLibrary = useMemo(() => {
        if (!searchQuery.trim()) return library;
        const query = searchQuery.toLowerCase();
        return library.filter(track =>
            track.title.toLowerCase().includes(query) ||
            track.artist.toLowerCase().includes(query) ||
            track.album.toLowerCase().includes(query)
        );
    }, [library, searchQuery]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
                <div className="animate-pulse">Scanning music folder...</div>
            </div>
        );
    }

    if (library.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-on-surface-variant/60">
                <IconMusicNote size={64} />
                <div className="text-center">
                    <h3 className="text-headline-small text-on-surface font-semibold">No tracks loaded</h3>
                    <p className="text-body-medium">Open a folder to load your music library</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Header - Non-sticky */}
            <div className="grid grid-cols-[3rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_4rem] gap-4 px-6 bg-surface">
                <span className="py-3 text-center text-label-large font-medium text-on-surface-variant">#</span>
                <SortHeader label="Title" sortKey="title" />
                <SortHeader label="Artist" sortKey="artist" />
                <SortHeader label="Album" sortKey="album" />
                <SortHeader label="Duration" sortKey="duration_secs" align="right" />
            </div>
            {/* Wavy separator below header */}
            <div className="px-6">
                <WavySeparator label="" color="var(--md-sys-color-outline-variant)" />
            </div>
            <div className="flex-1">
                <Virtuoso
                    style={{ height: '100%' }}
                    data={filteredLibrary}
                    overscan={200}
                    itemContent={(index, track) => {
                        // Check for album change
                        const prevTrack = index > 0 ? filteredLibrary[index - 1] : null;
                        const showSeparator = prevTrack && prevTrack.album !== track.album;

                        // User asked for "1 ... 25 (separator) 26". So only between albums. 
                        // If index==0, we might want it if we want to label the first group, but user example didn't explicitly ask.
                        // Let's stick to "separating". So index > 0.

                        return (
                            <div key={track.id}>
                                {showSeparator && (
                                    <div className="px-6">
                                        <WavySeparator label={track.album} color="var(--md-sys-color-primary)" />
                                    </div>
                                )}
                                <TrackRow
                                    track={track}
                                    index={index}
                                    isActive={currentPath === track.path}
                                    isPlaying={isPlaying}
                                    onClick={() => playFile(track.path)}
                                />
                            </div>
                        );
                    }}
                    components={{
                        Footer: () => <div className="h-24"></div>
                    }}
                />
            </div>
        </div>
    );
}

