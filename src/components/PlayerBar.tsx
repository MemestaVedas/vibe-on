import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';


// Format seconds to MM:SS
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function PlayerBar() {
    const { status, pause, resume, setVolume, refreshStatus, nextTrack, prevTrack, getCurrentTrackIndex, library } = usePlayerStore();
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

    return (
        <div className="fixed bottom-0 left-[220px] right-[280px] h-20 bg-[#0d0d0f]/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-between px-6 z-50">
            {/* Track Info */}
            <div className="w-[30%] flex items-center gap-4 group">
                <div className={`relative w-14 h-14 rounded-lg overflow-hidden shadow-lg transition-transform duration-500 ${state === 'Playing' ? 'scale-100' : 'scale-95 opacity-80'}`}>
                    {coverUrl ? (
                        <img src={coverUrl ?? undefined} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex justify-center items-center text-white/20">
                            <span className="text-2xl">♪</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col justify-center overflow-hidden">
                    {track ? (
                        <>
                            <div className="text-[15px] font-semibold text-white/95 leading-tight truncate">{track.title}</div>
                            <div className="text-[13px] text-white/60 leading-tight truncate mt-0.5">{track.artist}</div>
                        </>
                    ) : (
                        <div className="text-[15px] font-semibold text-white/30">Not Playing</div>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-1.5 flex-1 max-w-[40%]">
                <div className="flex items-center gap-6">
                    <button
                        className="text-white/50 hover:text-white transition-colors duration-200 p-2 rounded-full hover:bg-white/5 active:scale-95"
                        onClick={prevTrack}
                        disabled={!hasPrev}
                    >
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                    </button>
                    <button
                        className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
                        onClick={handlePlayPause}
                        disabled={!track}
                    >
                        {state === 'Playing' ? (
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                        ) : (
                            <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        )}
                    </button>
                    <button
                        className="text-white/50 hover:text-white transition-colors duration-200 p-2 rounded-full hover:bg-white/5 active:scale-95"
                        onClick={nextTrack}
                        disabled={!hasNext}
                    >
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                    </button>
                </div>

                <div className="w-full flex items-center gap-2.5 group/progress">
                    <span className="text-[10px] font-medium text-white/30 w-8 text-right tabular-nums">{formatTime(position_secs)}</span>
                    <div className="relative flex-1 h-8 flex items-center cursor-pointer group-hover/progress:h-8">
                        {/* Slider Rail */}
                        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            {/* Progress Fill */}
                            <div
                                className="h-full bg-white/40 rounded-full transition-all duration-100"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        {/* Interactive Range Input (Hidden but functional) */}
                        <input
                            type="range"
                            min="0"
                            max={track?.duration_secs || 100}
                            step="0.1"
                            value={position_secs}
                            onChange={() => {/* TODO */ }}
                            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
                            disabled={!track}
                        />
                        {/* Thumb (Visual only) */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover/progress:opacity-100 transition-opacity duration-200 pointer-events-none transform -translate-x-1/2"
                            style={{ left: `${progressPercent}%` }}
                        />
                    </div>
                    <span className="text-[10px] font-medium text-white/30 w-8 tabular-nums">{track ? formatTime(track.duration_secs) : '0:00'}</span>
                </div>
            </div>

            {/* Volume */}
            <div className="w-[30%] flex items-center justify-end gap-3 group/volume">
                <svg className="w-4 h-4 text-white/50" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor" /></svg>
                <div className="w-24 h-1 bg-white/10 rounded-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full bg-white/60 rounded-full" style={{ width: `${volume * 100}%` }} />
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </div>
            </div>
        </div>
    );

}
