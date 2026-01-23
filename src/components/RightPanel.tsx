import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { IconMusicNote, IconPlay } from './Icons';
import { MarqueeText } from './MarqueeText';

export function RightPanel() {
    const { status, library, history, playFile } = usePlayerStore();
    const { track } = status;

    // Get cover from library
    const currentIndex = library.findIndex(t => t.path === track?.path);
    const currentLibraryTrack = currentIndex >= 0 ? library[currentIndex] : null;
    const coverUrl = useCoverArt(currentLibraryTrack?.cover_image);

    // Get recently played from store (limit to 10 for display)
    const recentTracks = history.slice(0, 10);

    return (
        <aside className="h-full flex flex-col p-6 gap-8 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-container-high">

            {/* Now Playing Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-title-medium font-bold text-on-surface">Now Playing</h2>
            </div>

            {/* Main Art & Info */}
            <div className="flex flex-col items-center gap-6">
                {/* Large Art */}
                <div className="w-64 h-64 rounded-[2rem] bg-surface-container-high shadow-elevation-3 relative group overflow-hidden">
                    {coverUrl ? (
                        <img
                            src={coverUrl}
                            alt={track?.album || "Album Art"}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-on-surface-variant/50">
                            <IconMusicNote size={64} />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex flex-col items-center text-center gap-1 w-full px-2">
                    <div className="w-full text-headline-small font-bold text-on-surface truncate">
                        <MarqueeText text={track?.title || "Not Playing"} />
                    </div>
                    <div className="text-title-medium text-on-surface-variant truncate w-full">
                        {track?.artist || "Pick a song"}
                    </div>
                    <p className="text-label-medium text-on-surface-variant/60 mt-1 truncate max-w-full">
                        {track?.album}
                    </p>
                </div>
            </div>

            {/* Divider (Invisible spacing) */}
            <div className="flex-1" />

            {/* Recently Played / Queue */}
            <div className="flex flex-col gap-4">
                <h3 className="text-title-small font-semibold text-on-surface-variant/80 px-1">Recently Played</h3>

                <div className="flex flex-col gap-2">
                    {recentTracks.length === 0 && (
                        <div className="p-4 rounded-xl bg-surface-container-high/50 text-center">
                            <p className="text-body-small text-on-surface-variant">Start playing music to build your history!</p>
                        </div>
                    )}

                    {recentTracks.map((t, i) => (
                        <QueueItem
                            key={`${t.path}-${i}`}
                            track={t}
                            isActive={t.path === track?.path}
                            onClick={() => playFile(t.path)}
                        />
                    ))}
                </div>
            </div>
        </aside>
    );
}

function QueueItem({ track, isActive, onClick }: {
    track: { title: string; artist: string; cover_image?: string | null };
    isActive: boolean;
    onClick?: () => void;
}) {
    const coverUrl = useCoverArt(track.cover_image);

    return (
        <button
            onClick={onClick}
            className={`
                group flex items-center gap-3 p-2 rounded-xl text-left transition-all duration-200
                ${isActive
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'hover:bg-surface-container-high text-on-surface'
                }
            `}
        >
            {/* Tiny Art */}
            <div className={`
                w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-container-highest relative
                ${isActive ? 'shadow-sm' : ''}
            `}>
                {coverUrl ? (
                    <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <IconMusicNote size={16} className="opacity-50" />
                    </div>
                )}

                {/* Hover Play Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconPlay size={16} className="text-white fill-white" />
                </div>
            </div>

            <div className="flex flex-col min-w-0 flex-1">
                <span className={`text-label-large font-medium truncate ${isActive ? '' : 'text-on-surface'}`}>
                    {track.title}
                </span>
                <span className={`text-label-small truncate ${isActive ? 'text-on-secondary-container/80' : 'text-on-surface-variant'}`}>
                    {track.artist}
                </span>
            </div>
        </button>
    );
}
