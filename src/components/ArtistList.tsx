import { useState, useMemo, forwardRef } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { useThemeStore } from '../store/themeStore';
import type { TrackDisplay } from '../types';

interface Artist {
    name: string;
    cover: string | null;
    tracks: TrackDisplay[];
    albumCount: number;
}

export function ArtistList() {
    const library = usePlayerStore(state => state.library);
    const playFile = usePlayerStore(state => state.playFile);
    const { colors } = useThemeStore();
    const [selectedArtist, setSelectedArtist] = useState<string | null>(null);

    // Group tracks by artist
    const artists = useMemo(() => {
        const artistMap = new Map<string, Artist>();

        library.forEach(track => {
            const key = track.artist || "Unknown Artist";
            if (!artistMap.has(key)) {
                artistMap.set(key, {
                    name: key,
                    cover: track.cover_image || null,
                    tracks: [],
                    albumCount: 0
                });
            }
            const artist = artistMap.get(key)!;
            artist.tracks.push(track);
            // Update cover if missing (prefer first found)
            if (!artist.cover && track.cover_image) {
                artist.cover = track.cover_image;
            }
        });

        // Calculate album counts
        for (const artist of artistMap.values()) {
            const albums = new Set(artist.tracks.map(t => t.album));
            artist.albumCount = albums.size;
        }

        return Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [library]);

    const handlePlayArtist = (artist: Artist) => {
        if (artist.tracks.length > 0) {
            playFile(artist.tracks[0].path);
        }
    };

    if (selectedArtist) {
        const artist = artists.find(a => a.name === selectedArtist);
        if (!artist) return null;

        return (
            <ArtistDetailView
                artist={artist}
                onBack={() => setSelectedArtist(null)}
                onPlay={() => handlePlayArtist(artist)}
                accentColor={colors.accent1}
            />
        );
    }

    return (
        <VirtuosoGrid
            style={{ height: '100%' }}
            data={artists}
            overscan={200}
            components={{
                List: forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(({ style, children, ...props }, ref) => (
                    <div
                        ref={ref}
                        {...props}
                        style={{ ...style, width: '100%' }}
                        className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5 p-5 pb-24"
                    >
                        {children}
                    </div>
                )),
                Item: ({ children, ...props }) => (
                    <div {...props} style={{ padding: 0, margin: 0 }}>{children}</div>
                )
            }}
            itemContent={(_, artist) => (
                <ArtistCard
                    artist={artist}
                    onClick={() => setSelectedArtist(artist.name)}
                    onPlay={() => handlePlayArtist(artist)}
                    accentColor={colors.accent1}
                    accentForeground={colors.accent1Foreground}
                />
            )}
        />
    );
}

function ArtistCard({ artist, onClick, onPlay, accentColor, accentForeground }: { artist: Artist, onClick: () => void, onPlay: () => void, accentColor: string, accentForeground: string }) {
    const coverUrl = useCoverArt(artist.cover);

    return (
        <div className="bg-white/5 rounded-full p-4 cursor-pointer transition-colors duration-200 hover:bg-white/10 group flex flex-col items-center" onClick={onClick}>
            <div className="aspect-square w-full mb-3 rounded-full overflow-hidden relative shadow-lg">
                {coverUrl ? (
                    <img src={coverUrl} alt={artist.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#2a2a4e] to-[#1f1f3a] flex items-center justify-center text-4xl text-white/10 transition-transform duration-500 group-hover:scale-105">🎤</div>
                )}

                {/* Dark overlay on hover */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div
                    className="absolute bottom-3 right-3 w-12 h-12 rounded-full flex items-center justify-center translate-y-4 opacity-0 transition-all duration-300 shadow-xl group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105"
                    style={{ backgroundColor: accentColor, color: accentForeground }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlay();
                    }}
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </div>
            </div>
            <div className="text-center w-full">
                <div className="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis mb-1 group-hover:text-indigo-400 transition-colors" style={{ color: 'white' }}>{artist.name}</div>
                <div className="text-xs text-white/50">{artist.albumCount} albums • {artist.tracks.length} songs</div>
            </div>
        </div>
    );
}

function ArtistDetailView({ artist, onBack, onPlay, accentColor }: { artist: Artist, onBack: () => void, onPlay: () => void, accentColor: string }) {
    const { playFile } = usePlayerStore();
    const coverUrl = useCoverArt(artist.cover);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#141423cc] to-[#0a0a14f2]">
            <div className="p-8 bg-gradient-to-b from-indigo-500/10 to-transparent">
                <button className="bg-none border-none text-white/60 text-sm cursor-pointer mb-6 p-0 hover:text-white hover:underline flex items-center gap-1" onClick={onBack}>
                    <span>←</span> Back to Artists
                </button>
                <div className="flex gap-8 items-center">
                    {coverUrl ? (
                        <img src={coverUrl} alt={artist.name} className="w-[180px] h-[180px] rounded-full shadow-2xl object-cover" />
                    ) : (
                        <div className="w-[180px] h-[180px] rounded-full bg-white/10 flex items-center justify-center text-6xl text-white/20 shadow-2xl">🎤</div>
                    )}
                    <div className="flex flex-col gap-2">
                        <h1 className="text-5xl font-extrabold m-0 leading-tight text-white">{artist.name}</h1>
                        <p className="text-white/60 m-0 mb-6">{artist.albumCount} Albums • {artist.tracks.length} Songs</p>
                        <button
                            className="text-white border-none py-3 px-8 rounded-full text-base font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:scale-105 w-fit"
                            style={{ backgroundColor: accentColor }}
                            onClick={onPlay}
                        >
                            Play Artist
                        </button>
                    </div>
                </div>
            </div>
            <div className="px-8 pb-8 overflow-y-auto pb-[100px] flex-1">
                {artist.tracks.map((track, i) => (
                    <div key={track.id} className="grid grid-cols-[40px_1fr_1fr_60px] py-3 px-4 rounded text-white/80 cursor-pointer transition-colors duration-100 hover:bg-white/10 hover:text-white border-b border-white/5" onClick={() => playFile(track.path)}>
                        <span className="text-white/40">{i + 1}</span>
                        <span className="font-medium truncate pr-4">{track.title}</span>
                        <span className="text-white/50 truncate pr-4">{track.album}</span>
                        <span className="text-right text-white/40 font-mono text-xs pt-1">
                            {Math.floor(track.duration_secs / 60)}:
                            {Math.floor(track.duration_secs % 60).toString().padStart(2, '0')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
