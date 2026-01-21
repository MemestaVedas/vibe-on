import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';

export function RightPanel() {
    const { status, library } = usePlayerStore();
    const { track } = status;

    // Get cover from library
    const currentIndex = library.findIndex(t => t.path === track?.path);
    const currentLibraryTrack = currentIndex >= 0 ? library[currentIndex] : null;
    const coverUrl = useCoverArt(currentLibraryTrack?.cover_image);

    // Get recently played (just show some tracks from library for now)
    const recentTracks = library.slice(0, 5);

    return (
        <aside className="w-[280px] h-full flex flex-col bg-black/20 border-l border-white/5 overflow-hidden">
            {/* Now Playing */}
            <div className="p-5 border-b border-white/5">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-4">Now Playing</p>

                {track ? (
                    <div className="flex flex-col items-center">
                        <div className="w-full aspect-square rounded-xl overflow-hidden shadow-2xl mb-4 bg-white/5">
                            {coverUrl ? (
                                <img src={coverUrl} alt={track.album} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-6xl text-white/10">
                                    ♪
                                </div>
                            )}
                        </div>
                        <h3 className="text-sm font-semibold text-white text-center truncate w-full">{track.title}</h3>
                        <p className="text-xs text-white/50 text-center truncate w-full mt-1">{track.artist}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center py-8">
                        <div className="w-20 h-20 rounded-xl bg-white/5 flex items-center justify-center text-3xl text-white/10 mb-4">
                            ♪
                        </div>
                        <p className="text-sm text-white/30">No track playing</p>
                    </div>
                )}
            </div>

            {/* Queue / Up Next */}
            <div className="flex-1 p-5 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Up Next</p>
                    <button className="text-[10px] text-indigo-400 hover:text-indigo-300">See all</button>
                </div>

                <div className="space-y-2">
                    {recentTracks.map((t, i) => (
                        <QueueItem
                            key={t.path}
                            track={t}
                            isActive={t.path === track?.path}
                            index={i + 1}
                        />
                    ))}
                </div>
            </div>
        </aside>
    );
}

function QueueItem({ track, isActive, index }: {
    track: { title: string; artist: string; cover_image?: string | null };
    isActive: boolean;
    index: number;
}) {
    const coverUrl = useCoverArt(track.cover_image);

    return (
        <div className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}>
            <div className="w-10 h-10 rounded-md overflow-hidden bg-white/5 flex-shrink-0">
                {coverUrl ? (
                    <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                        {index}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${isActive ? 'text-indigo-400' : 'text-white/80'}`}>{track.title}</p>
                <p className="text-[10px] text-white/40 truncate">{track.artist}</p>
            </div>
        </div>
    );
}
