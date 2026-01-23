import { useState, useMemo, forwardRef } from 'react';
import { VirtuosoGrid, Virtuoso } from 'react-virtuoso';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import type { TrackDisplay } from '../types';
import { IconMusicNote, IconPlay } from './Icons';


interface Album {
    name: string;
    artist: string;
    cover: string | null;
    tracks: TrackDisplay[];
}

export function AlbumGrid() {
    const library = usePlayerStore(state => state.library);
    const playFile = usePlayerStore(state => state.playFile);
    const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);

    // Group tracks by album
    const albums = useMemo(() => {
        const albumMap = new Map<string, Album>();

        library.forEach(track => {
            const key = `${track.album}-${track.artist}`;
            if (!albumMap.has(key)) {
                albumMap.set(key, {
                    name: track.album,
                    artist: track.artist,
                    cover: track.cover_image || null,
                    tracks: []
                });
            }
            albumMap.get(key)?.tracks.push(track);
        });

        return Array.from(albumMap.values());
    }, [library]);

    const handlePlayAlbum = (album: Album) => {
        console.log("Play Album clicked:", album.name);
        if (album.tracks.length > 0) {
            const firstTrackPath = album.tracks[0].path;
            console.log("Playing first track:", firstTrackPath);
            playFile(firstTrackPath);
        } else {
            console.warn("Album has no tracks:", album.name);
        }
    };

    if (selectedAlbum) {
        const album = albums.find(a => `${a.name}-${a.artist}` === selectedAlbum);
        if (!album) return null;

        return (
            <AlbumDetailView
                album={album}
                onBack={() => setSelectedAlbum(null)}
                onPlay={() => handlePlayAlbum(album)}
            />
        );
    }

    return (
        <VirtuosoGrid
            style={{ height: '100%' }}
            data={albums}
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
            itemContent={(_, album) => (
                <AlbumCard
                    key={`${album.name}-${album.artist}`}
                    album={album}
                    onClick={() => setSelectedAlbum(`${album.name}-${album.artist}`)}
                    onPlay={() => handlePlayAlbum(album)}
                />
            )}
        />
    );
}

function AlbumCard({ album, onClick, onPlay }: { album: Album, onClick: () => void, onPlay: () => void }) {
    const coverUrl = useCoverArt(album.cover);

    return (
        <div
            onClick={onClick}
            className="group flex flex-col gap-3 p-3 rounded-[1.5rem] hover:bg-surface-container-high transition-colors cursor-pointer"
        >
            <div className="aspect-square w-full relative rounded-2xl overflow-hidden shadow-elevation-1 group-hover:shadow-elevation-2 transition-shadow bg-surface-container">
                {coverUrl ? (
                    <img src={coverUrl} alt={album.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant/50">
                        <IconMusicNote size={48} />
                    </div>
                )}

                {/* Play Button Overlay */}
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlay();
                    }}
                    className="absolute bottom-3 right-3 w-12 h-12 bg-primary text-on-primary rounded-xl flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-elevation-2 hover:scale-105 active:scale-95 z-20"
                >
                    <IconPlay size={24} fill="currentColor" />
                </div>
            </div>

            <div className="px-1">
                <div className="text-title-medium font-semibold text-on-surface truncate" title={album.name}>{album.name}</div>
                <div className="text-body-medium text-on-surface-variant truncate" title={album.artist}>{album.artist}</div>
            </div>
        </div>
    );
}

function AlbumDetailView({ album, onBack, onPlay }: { album: Album, onBack: () => void, onPlay: () => void }) {
    const { playFile } = usePlayerStore();
    const coverUrl = useCoverArt(album.cover);

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Header */}
            <div className="p-8 flex gap-8 items-end bg-surface-container-low shrink-0">
                <div className="w-52 h-52 shrink-0 rounded-[2rem] overflow-hidden shadow-elevation-3 bg-surface-container">
                    {coverUrl ? (
                        <img src={coverUrl} alt={album.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant/50">
                            <IconMusicNote size={64} />
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4 mb-2 min-w-0">
                    <div>
                        <div className="text-label-large font-medium text-on-surface-variant uppercase tracking-wider mb-1">Album</div>
                        <h1 className="text-display-medium font-bold text-on-surface tracking-tight truncate">{album.name}</h1>
                    </div>

                    <div className="flex items-center gap-2 text-title-medium">
                        <span className="font-semibold text-primary">{album.artist}</span>
                        <span className="text-on-surface-variant">• {album.tracks.length} tracks</span>
                    </div>

                    <div className="flex gap-3 mt-2">
                        <button
                            onClick={onPlay}
                            className="h-10 px-6 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 flex items-center gap-2 shadow-elevation-1 transition-transform active:scale-95"
                        >
                            <IconPlay size={20} fill="currentColor" /> Play
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
                    data={album.tracks}
                    overscan={100}
                    itemContent={(i, track) => (
                        <div
                            key={track.id}
                            onClick={() => playFile(track.path)}
                            className="group flex items-center gap-4 p-3 rounded-xl hover:bg-surface-container-highest cursor-pointer text-on-surface-variant hover:text-on-surface transition-colors"
                        >
                            <span className="w-8 text-center text-title-medium font-medium opacity-60 group-hover:opacity-100">{i + 1}</span>
                            <span className="flex-1 font-medium text-body-large truncate">{track.title}</span>
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

