import { useState, useMemo, forwardRef } from 'react';
import { VirtuosoGrid, Virtuoso } from 'react-virtuoso';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { IconMicrophone, IconPlay } from './Icons';
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
                        className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-6 content-start"
                        style={{ ...style, width: '100%' }}
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
                />
            )}
        />
    );
}

function ArtistCard({ artist, onClick, onPlay }: { artist: Artist, onClick: () => void, onPlay: () => void }) {
    const coverUrl = useCoverArt(artist.cover);

    return (
        <div
            onClick={onClick}
            className="group flex flex-col gap-3 p-3 rounded-[1.5rem] hover:bg-surface-container-high transition-colors cursor-pointer"
        >
            <div className="aspect-square w-full relative rounded-full overflow-hidden shadow-elevation-1 group-hover:shadow-elevation-2 transition-shadow bg-surface-container">
                {coverUrl ? (
                    <img src={coverUrl} alt={artist.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant/50">
                        <IconMicrophone size={48} />
                    </div>
                )}

                {/* Play Button Overlay */}
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlay();
                    }}
                    className="absolute bottom-2 right-2 w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-elevation-2 hover:scale-105 active:scale-95 z-20"
                >
                    <IconPlay size={24} fill="currentColor" />
                </div>
            </div>

            <div className="px-1 text-center">
                <div className="text-title-medium font-semibold text-on-surface truncate" title={artist.name}>{artist.name}</div>
                <div className="text-body-medium text-on-surface-variant truncate">
                    {artist.albumCount} albums • {artist.tracks.length} songs
                </div>
            </div>
        </div>
    );
}

function ArtistDetailView({ artist, onBack, onPlay }: { artist: Artist, onBack: () => void, onPlay: () => void }) {
    const { playFile } = usePlayerStore();
    const coverUrl = useCoverArt(artist.cover);

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Header */}
            <div className="p-8 flex gap-8 items-center bg-surface-container-low shrink-0">
                <div className="w-52 h-52 shrink-0 rounded-full overflow-hidden shadow-elevation-3 bg-surface-container">
                    {coverUrl ? (
                        <img src={coverUrl} alt={artist.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant/50">
                            <IconMicrophone size={64} />
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4 min-w-0 flex-1">
                    <div>
                        <div className="text-label-large font-medium text-on-surface-variant uppercase tracking-wider mb-1">Artist</div>
                        <h1 className="text-display-medium font-bold text-on-surface tracking-tight truncate">{artist.name}</h1>
                    </div>

                    <div className="text-title-medium text-on-surface-variant">
                        {artist.albumCount} Albums • {artist.tracks.length} Songs
                    </div>

                    <div className="flex gap-3 mt-2">
                        <button
                            onClick={onPlay}
                            className="h-10 px-6 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 flex items-center gap-2 shadow-elevation-1 transition-transform active:scale-95"
                        >
                            <IconPlay size={20} fill="currentColor" /> Play Artist
                        </button>
                        <button
                            onClick={onBack}
                            className="h-10 px-6 border border-outline rounded-full text-on-surface font-medium hover:bg-surface-container-high transition-colors"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </div>

            {/* Tracklist */}
            <div className="flex-1 p-6">
                <Virtuoso
                    style={{ height: '100%' }}
                    data={artist.tracks}
                    overscan={100}
                    itemContent={(i, track) => (
                        <div
                            key={track.id}
                            onClick={() => playFile(track.path)}
                            className="group flex items-center gap-4 p-3 rounded-xl hover:bg-surface-container-highest cursor-pointer text-on-surface-variant hover:text-on-surface transition-colors"
                        >
                            <span className="w-8 text-center text-title-medium font-medium opacity-60 group-hover:opacity-100">{i + 1}</span>
                            <span className="flex-1 font-medium text-body-large truncate">{track.title}</span>
                            <span className="flex-1 text-body-medium text-on-surface-variant/80 truncate">{track.album}</span>
                            <span className="text-label-medium font-medium opacity-60 tabular-nums">
                                {Math.floor(track.duration_secs / 60)}:
                                {Math.floor(track.duration_secs % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                    )}
                    components={{
                        Footer: () => <div className="h-24"></div>
                    }}
                />
            </div>
        </div>
    );
}

