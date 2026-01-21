import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import './PlayerBar.css';

// Format seconds to MM:SS
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function PlayerBar() {
    const { status, pause, resume, stop, setVolume, refreshStatus } = usePlayerStore();
    const { state, track, position_secs, volume } = status;

    // Poll for status updates while playing
    useEffect(() => {
        if (state === 'Playing') {
            const interval = setInterval(refreshStatus, 500);
            return () => clearInterval(interval);
        }
    }, [state, refreshStatus]);

    const handlePlayPause = () => {
        if (state === 'Playing') {
            pause();
        } else if (state === 'Paused') {
            resume();
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVolume(parseFloat(e.target.value));
    };

    const progress = track ? (position_secs / track.duration_secs) * 100 : 0;

    const coverUrl = useCoverArt(track?.cover_image);

    return (
        <div className="player-bar">
            <div className="player-bar-track">
                {coverUrl ? (
                    <img src={coverUrl} alt="Cover" className="track-cover" />
                ) : (
                    <div className="track-cover-placeholder">♪</div>
                )}
                <div className="track-info">
                    {track ? (
                        <>
                            <div className="track-title">{track.title}</div>
                            <div className="track-artist">{track.artist}</div>
                        </>
                    ) : (
                        <div className="track-title empty">No track playing</div>
                    )}
                </div>
            </div>

            <div className="player-bar-controls">
                <div className="control-buttons">
                    <button
                        className="control-btn"
                        onClick={handlePlayPause}
                        disabled={!track}
                    >
                        {state === 'Playing' ? '⏸' : '▶'}
                    </button>
                    <button
                        className="control-btn"
                        onClick={stop}
                        disabled={!track}
                    >
                        ⏹
                    </button>
                </div>

                <div className="progress-container">
                    <span className="time">{formatTime(position_secs)}</span>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                    <span className="time">{track ? formatTime(track.duration_secs) : '0:00'}</span>
                </div>
            </div>

            <div className="player-bar-volume">
                <span className="volume-icon">🔊</span>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="volume-slider"
                />
            </div>
        </div>
    );
}
