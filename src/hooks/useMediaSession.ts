import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from './useCoverArt';

export function useMediaSession() {
    const { status, pause, resume, nextTrack, prevTrack, playFile } = usePlayerStore();
    const { state, track } = status;
    const coverUrl = useCoverArt(track?.cover_image, track?.path || undefined, true);

    // Maintain a silent audio element to ensure the WebView holds media focus
    // This allows the Windows Media Controls to appear and remain active
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio element
    useEffect(() => {
        if (!audioRef.current) {
            const audio = new Audio();
            // Tiny silent wav file (base64)
            audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAGZGF0YQAAAAA=';
            audio.loop = true;
            audio.volume = 0.001; // Nearly silent, just in case
            audioRef.current = audio;
        }
    }, []);

    // Sync Playback State (Playing/Paused)
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (state === 'Playing') {
            audio.play().catch(e => {
                // Ignore autoplay policy errors (interaction usually enables it)
                console.debug("Silent audio play failed", e);
            });
            navigator.mediaSession.playbackState = 'playing';
        } else {
            audio.pause();
            navigator.mediaSession.playbackState = 'paused';
        }
    }, [state]);

    // Sync Metadata (Title, Artist, Cover)
    useEffect(() => {
        if (track) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.artist,
                artwork: coverUrl ? [{ src: coverUrl, sizes: '512x512', type: 'image/png' }] : undefined
            });
        } else {
            navigator.mediaSession.metadata = null;
        }
    }, [track, coverUrl]);

    // Register Action Handlers
    useEffect(() => {
        navigator.mediaSession.setActionHandler('play', () => {
            // Intelligent play: resume if paused, replay if stopped
            if (state === 'Stopped' && track) {
                playFile(track.path);
            } else {
                resume();
            }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            pause();
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            prevTrack();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
            nextTrack();
        });

        // Cleanup
        return () => {
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('previoustrack', null);
            navigator.mediaSession.setActionHandler('nexttrack', null);
        };
    }, [resume, pause, nextTrack, prevTrack, playFile, state, track]);
}
