import { useState, useMemo, forwardRef } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import type { TrackDisplay } from '../types';


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
                        style={{ ...style, width: '100%' }}
                        className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5 p-5 pb-24"
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
        <div className="bg-white/5 rounded-xl p-4 cursor-pointer transition-colors duration-200 hover:bg-white/10 group" onClick={onClick}>
            <div className="aspect-square w-full mb-3 rounded-lg overflow-hidden relative shadow-lg">
                {coverUrl ? (
                    <img src={coverUrl} alt={album.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#2a2a4e] to-[#1f1f3a] flex items-center justify-center text-4xl text-white/10 transition-transform duration-500 group-hover:scale-105">♪</div>
                )}
                {/* Dark overlay on hover */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div
                    className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-indigo-500 text-white flex items-center justify-center translate-y-4 opacity-0 transition-all duration-300 shadow-xl group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 hover:bg-indigo-400"
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
            <div className="text-left">
                <div className="text-sm font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis mb-1 group-hover:text-indigo-400 transition-colors">{album.name}</div>
                <div className="text-xs text-white/60 whitespace-nowrap overflow-hidden text-ellipsis">{album.artist}</div>
            </div>
        </div>
    );
}

function AlbumDetailView({ album, onBack, onPlay }: { album: Album, onBack: () => void, onPlay: () => void }) {
    const { playFile } = usePlayerStore();
    const coverUrl = useCoverArt(album.cover);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#141423cc] to-[#0a0a14f2]">
            <div className="p-8 bg-gradient-to-b from-indigo-500/10 to-transparent">
                <button className="bg-none border-none text-white/60 text-sm cursor-pointer mb-6 p-0 hover:text-white hover:underline flex items-center gap-1" onClick={onBack}>
                    <span>←</span> Back to Albums
                </button>
                <div className="flex gap-8 items-end">
                    {coverUrl ? (
                        <img src={coverUrl} alt={album.name} className="w-[200px] h-[200px] rounded-lg shadow-2xl object-cover" />
                    ) : (
                        <div className="w-[200px] h-[200px] rounded-lg bg-white/10 flex items-center justify-center text-6xl text-white/20 shadow-2xl">♪</div>
                    )}
                    <div className="flex flex-col gap-2 mb-2">
                        <h1 className="text-5xl font-extrabold m-0 leading-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">{album.name}</h1>
                        <h2 className="text-2xl font-medium text-white/80 m-0 mb-4">{album.artist}</h2>
                        <p className="text-white/60 m-0 mb-6">{album.tracks.length} tracks</p>
                        <button
                            className="bg-indigo-500 text-white border-none py-3 px-8 rounded-full text-base font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:scale-105 hover:bg-indigo-600 w-fit"
                            onClick={onPlay}
                        >
                            Play Album
                        </button>
                    </div>
                </div>
            </div>
            <div className="px-8 pb-8 overflow-y-auto pb-[100px]">
                {album.tracks.map((track, i) => (
                    <div key={track.id} className="grid grid-cols-[40px_1fr_60px] py-3 px-4 rounded text-white/80 cursor-pointer transition-colors duration-100 hover:bg-white/10 hover:text-white" onClick={() => playFile(track.path)}>
                        <span className="text-white/40">{i + 1}</span>
                        <span className="font-medium">{track.title}</span>
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
