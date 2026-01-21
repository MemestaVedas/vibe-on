import { useEffect, useRef } from 'react';
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
    const { status, pause, resume, stop, setVolume, refreshStatus, nextTrack, prevTrack, getCurrentTrackIndex, library } = usePlayerStore();
    const { state, track, position_secs, volume } = status;
    const lastStateRef = useRef(state);

    // Poll for status updates while playing
    useEffect(() => {
        if (state === 'Playing') {
            const interval = setInterval(refreshStatus, 500);
            return () => clearInterval(interval);
        }
    }, [state, refreshStatus]);

    // Auto-play next track when current track ends
    useEffect(() => {
        // Detect when track ends: state changes from Playing to Stopped
        // and we have a track, and position is near the end
        if (lastStateRef.current === 'Playing' && state === 'Stopped' && track) {
            const isNearEnd = position_secs >= track.duration_secs - 1;
            if (isNearEnd) {
                nextTrack();
            }
        }
        lastStateRef.current = state;
    }, [state, track, position_secs, nextTrack]);

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

    const currentIndex = getCurrentTrackIndex();
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < library.length - 1;

    // Calculate progress percentage for seek bar styling
    const progressPercent = track ? (position_secs / track.duration_secs) * 100 : 0;

    // Get cover from library since player status doesn't include cover path
    const currentLibraryTrack = currentIndex >= 0 ? library[currentIndex] : null;
    const coverUrl = useCoverArt(currentLibraryTrack?.cover_image);

    // Dynamic style for progress slider to show filled portion (WebKit doesn't support ::-webkit-slider-runnable-track progress)
    const progressSliderStyle = {
        background: `linear-gradient(to right, #667eea 0%, #764ba2 ${progressPercent}%, rgba(255, 255, 255, 0.2) ${progressPercent}%, rgba(255, 255, 255, 0.2) 100%)`
    };

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
                        onClick={prevTrack}
                        disabled={!hasPrev}
                        title="Previous track"
                    >
                        ⏮
                    </button>
                    <button
                        className="control-btn play-btn"
                        onClick={handlePlayPause}
                        disabled={!track}
                    >
                        {state === 'Playing' ? '⏸' : '▶'}
                    </button>
                    <button
                        className="control-btn"
                        onClick={nextTrack}
                        disabled={!hasNext}
                        title="Next track"
                    >
                        ⏭
                    </button>
                    <button
                        className="control-btn stop-btn"
                        onClick={stop}
                        disabled={!track}
                        title="Stop"
                    >
                        ⏹
                    </button>
                </div>

                <div className="progress-container">
                    <span className="time">{formatTime(position_secs)}</span>
                    <input
                        type="range"
                        min="0"
                        max={track?.duration_secs || 100}
                        step="0.1"
                        value={position_secs}
                        onChange={() => {/* TODO: Implement seek in backend */ }}
                        className="progress-slider"
                        style={progressSliderStyle}
                        disabled={!track}
                    />
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
