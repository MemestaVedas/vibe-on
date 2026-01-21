import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import type { TrackDisplay } from '../types';
import './TrackList.css';

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
            className={`track-row ${isActive ? 'active' : ''}`}
            onClick={onClick}
        >
            <span className="col-num">
                {isActive && isPlaying ? (
                    <span className="playing-indicator">▶</span>
                ) : (
                    index + 1
                )}
            </span>
            <span className="col-title">
                {coverUrl ? (
                    <img src={coverUrl} alt="" className="list-cover" />
                ) : (
                    <div className="list-cover-placeholder" />
                )}
                {track.title}
            </span>
            <span className="col-artist">{track.artist}</span>
            <span className="col-album">{track.album}</span>
            <span className="col-duration">{formatDuration(track.duration_secs)}</span>
        </div>
    );
}

export function TrackList() {
    const { library, playFile, status, isLoading } = usePlayerStore();
    const currentPath = status.track?.path;

    if (isLoading) {
        return (
            <div className="track-list-loading">
                <div className="loading-spinner" />
                <span>Scanning music folder...</span>
            </div>
        );
    }

    if (library.length === 0) {
        return (
            <div className="track-list-empty">
                <div className="empty-icon">🎵</div>
                <h3>No tracks loaded</h3>
                <p>Open a folder to load your music library</p>
            </div>
        );
    }

    return (
        <div className="track-list">
            <div className="track-list-header">
                <span className="col-num">#</span>
                <span className="col-title">Title</span>
                <span className="col-artist">Artist</span>
                <span className="col-album">Album</span>
                <span className="col-duration">Duration</span>
            </div>
            <div className="track-list-body">
                {library.map((track, index) => (
                    <TrackRow
                        key={track.id}
                        track={track}
                        index={index}
                        isActive={currentPath === track.path}
                        isPlaying={status.state === 'Playing'}
                        onClick={() => playFile(track.path)}
                    />
                ))}
            </div>
        </div>
    );
}
