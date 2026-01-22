import { Virtuoso } from 'react-virtuoso';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { IconMusicNote, IconPlay } from './Icons';
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
                px-4 py-3 mx-2 rounded-lg cursor-pointer transition-colors
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
                <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-surface-container shadow-sm">
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
            <div className="grid grid-cols-[3rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_4rem] gap-4 px-6 border-b border-outline-variant/10 bg-surface sticky top-0 z-10 backdrop-blur-sm bg-surface/90">
                <span className="py-3 text-center text-label-large font-medium text-on-surface-variant">#</span>
                <SortHeader label="Title" sortKey="title" />
                <SortHeader label="Artist" sortKey="artist" />
                <SortHeader label="Album" sortKey="album" />
                <SortHeader label="Duration" sortKey="duration_secs" align="right" />
            </div>
            <div className="flex-1">
                <Virtuoso
                    style={{ height: '100%' }}
                    data={library}
                    overscan={200}
                    itemContent={(index, track) => (
                        <TrackRow
                            key={track.id}
                            track={track}
                            index={index}
                            isActive={currentPath === track.path}
                            isPlaying={isPlaying}
                            onClick={() => playFile(track.path)}
                        />
                    )}
                    components={{
                        Footer: () => <div className="h-24"></div>
                    }}
                />
            </div>
        </div>
    );
}

