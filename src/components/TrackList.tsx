import { Virtuoso } from 'react-virtuoso';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
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
            className={`group grid grid-cols-[40px_2fr_1.5fr_1fr_60px] gap-4 px-4 py-3 cursor-pointer transition-all duration-200 rounded-lg mx-3 border border-transparent ${isActive ? 'bg-white/10 shadow-lg border-white/5' : 'hover:bg-white/5 hover:border-white/5'}`}
            onClick={onClick}
        >
            <span className="text-sm text-white/40 flex items-center justify-center font-medium group-hover:text-white/60">
                {isActive && isPlaying ? (
                    <div className="flex items-end justify-center gap-0.5 h-3 w-3">
                        <div className="w-1 bg-indigo-500 animate-[bounce_1s_infinite] h-full"></div>
                        <div className="w-1 bg-indigo-500 animate-[bounce_1.2s_infinite] h-[60%]"></div>
                        <div className="w-1 bg-indigo-500 animate-[bounce_0.8s_infinite] h-[80%]"></div>
                    </div>
                ) : (
                    index + 1
                )}
            </span>
            <span className={`text-[15px] font-medium whitespace-nowrap overflow-hidden text-ellipsis flex items-center ${isActive ? 'text-indigo-400' : 'text-white/90'}`}>
                {coverUrl ? (
                    <img src={coverUrl} alt="" className="w-10 h-10 rounded-md object-cover mr-4 shadow-sm bg-white/5" />
                ) : (
                    <div className="w-10 h-10 rounded-md bg-white/5 mr-4 border border-white/5" />
                )}
                {track.title}
            </span>
            <span className="text-[14px] text-white/50 whitespace-nowrap overflow-hidden text-ellipsis flex items-center group-hover:text-white/70 transition-colors">{track.artist}</span>
            <span className="text-[14px] text-white/50 whitespace-nowrap overflow-hidden text-ellipsis flex items-center group-hover:text-white/70 transition-colors">{track.album}</span>
            <span className="text-xs text-white/40 text-right flex items-center justify-end font-medium tabular-nums">{formatDuration(track.duration_secs)}</span>
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
            className={`flex items-center gap-1 cursor-pointer hover:text-white transition-colors ${align === 'right' ? 'justify-end' : 'justify-start'} ${isActive ? 'text-indigo-400' : ''}`}
            onClick={() => setSort(sortKey)}
        >
            {label}
            {isActive && (
                <span className="text-[10px]">
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
            <div className="flex-1 flex flex-col items-center justify-center text-white/50 gap-4">
                <div className="w-10 h-10 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin" />
                <span>Scanning music folder...</span>
            </div>
        );
    }

    if (library.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-white/50 gap-4">
                <div className="text-6xl opacity-50">🎵</div>
                <h3 className="text-xl text-white/80 m-0">No tracks loaded</h3>
                <p className="text-sm m-0">Open a folder to load your music library</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-[40px_2fr_1.5fr_1fr_60px] gap-4 px-4 mx-3 py-2 border-b border-white/5 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 select-none">
                <span className="text-center">#</span>
                <SortHeader label="Title" sortKey="title" />
                <SortHeader label="Artist" sortKey="artist" />
                <SortHeader label="Album" sortKey="album" />
                <SortHeader label="Duration" sortKey="duration_secs" align="right" />
            </div>
            <div className="flex-1 overflow-hidden">
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
                        Footer: () => <div className="h-[100px]" />
                    }}
                />
            </div>
        </div>
    );
}
