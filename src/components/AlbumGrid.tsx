import { useState, useMemo } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import type { TrackDisplay } from '../types';
import './AlbumGrid.css';

interface Album {
    name: string;
    artist: string;
    cover: string | null;
    tracks: TrackDisplay[];
}

export function AlbumGrid() {
    const { library, playFile } = usePlayerStore();
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
        if (album.tracks.length > 0) {
            playFile(album.tracks[0].path);
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
        <div className="album-grid">
            {albums.map(album => (
                <AlbumCard
                    key={`${album.name}-${album.artist}`}
                    album={album}
                    onClick={() => setSelectedAlbum(`${album.name}-${album.artist}`)}
                    onPlay={() => handlePlayAlbum(album)}
                />
            ))}
        </div>
    );
}

function AlbumCard({ album, onClick, onPlay }: { album: Album, onClick: () => void, onPlay: () => void }) {
    const coverUrl = useCoverArt(album.cover);

    return (
        <div className="album-card" onClick={onClick}>
            <div className="album-cover-container">
                {coverUrl ? (
                    <img src={coverUrl} alt={album.name} className="album-card-cover" />
                ) : (
                    <div className="album-card-placeholder">♪</div>
                )}
                <div className="album-hover-play" onClick={(e) => {
                    e.stopPropagation();
                    onPlay();
                }}>
                    ▶
                </div>
            </div>
            <div className="album-card-info">
                <div className="album-card-title">{album.name}</div>
                <div className="album-card-artist">{album.artist}</div>
            </div>
        </div>
    );
}

function AlbumDetailView({ album, onBack, onPlay }: { album: Album, onBack: () => void, onPlay: () => void }) {
    const { playFile } = usePlayerStore();
    const coverUrl = useCoverArt(album.cover);

    return (
        <div className="album-detail-view">
            <div className="album-detail-header">
                <button className="back-btn" onClick={onBack}>
                    ← Back to Albums
                </button>
                <div className="album-hero">
                    {coverUrl ? (
                        <img src={coverUrl} alt={album.name} className="hero-cover" />
                    ) : (
                        <div className="hero-cover-placeholder">♪</div>
                    )}
                    <div className="hero-info">
                        <h1>{album.name}</h1>
                        <h2>{album.artist}</h2>
                        <p>{album.tracks.length} tracks</p>
                        <button className="play-album-btn" onClick={onPlay}>
                            Play Album
                        </button>
                    </div>
                </div>
            </div>
            <div className="album-tracks-list">
                {album.tracks.map((track, i) => (
                    <div key={track.id} className="album-track-row" onClick={() => playFile(track.path)}>
                        <span className="track-num">{i + 1}</span>
                        <span className="track-name">{track.title}</span>
                        <span className="track-duration">
                            {Math.floor(track.duration_secs / 60)}:
                            {Math.floor(track.duration_secs % 60).toString().padStart(2, '0')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
