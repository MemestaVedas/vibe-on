import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useLyricsStore } from '../store/lyricsStore';
import { useSettingsStore } from '../store/settingsStore';
import { useMobileStore } from '../store/mobileStore';

import { useShallow } from 'zustand/react/shallow';

export function GlobalEffects() {
    const { resume, pause } = usePlayerStore(useShallow(state => ({
        resume: state.resume,
        pause: state.pause
    })));

    useEffect(() => {
        import('@tauri-apps/api/event').then(({ listen }) => {
            const unlisten = Promise.all([
                listen('media:play', () => resume()),
                listen('media:pause', () => pause()),
                listen('media:next', () => usePlayerStore.getState().nextTrack()),
                listen('media:prev', () => usePlayerStore.getState().prevTrack()),
                listen('media:toggle', () => {
                    const store = usePlayerStore.getState();
                    if (store.status.state === 'Playing') store.pause();
                    else store.resume();
                }),
                listen('media:stop', () => usePlayerStore.getState().stop()),

                // Mobile Events
                listen('mobile_client_connected', (event: any) => {
                    console.log('[Mobile] Client connected event:', event.payload);
                    const { client_id, client_name } = event.payload;
                    const device = {
                        id: client_id,
                        name: client_name || 'Mobile Device',
                        ip: 'unknown',
                        port: 0,
                        connectedAt: Date.now(),
                        platform: 'android',
                    };
                    useMobileStore.getState().setConnectedDevice(device);
                }),

                listen('mobile_client_disconnected', (event: any) => {
                    console.log('[Mobile] Client disconnected event:', event.payload);
                    useMobileStore.getState().disconnect();
                }),

                listen('refresh-player-state', () => {
                    console.log('[Native] Refreshing player state from backend event');
                    usePlayerStore.getState().refreshStatus();
                }),

                listen('output-changed', (event: any) => {
                    console.log('[Output] Output changed:', event.payload);
                    const { output } = event.payload;
                    const playerStore = usePlayerStore.getState();

                    if (output === 'mobile') {
                        console.log('[Output] Switching to mobile playback');
                        playerStore.pause();
                    } else if (output === 'desktop') {
                        console.log('[Output] Switching to desktop playback');
                    }
                }),

                listen('mobile-position-update', (event: any) => {
                    const { position_secs } = event.payload;
                    const store = usePlayerStore.getState();
                    if (store.audioOutput === 'mobile') {
                        // Override local scrub state smoothly directly bypassing setter for speed
                        usePlayerStore.setState(state => ({
                            status: { ...state.status, position_secs }
                        }));
                    }
                }),
            ]);

            return () => {
                unlisten.then(unlisteners => unlisteners.forEach(u => u()));
            };
        });
    }, [resume, pause]);

    // 2. Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.code === 'Space') {
                e.preventDefault();
                const { status, pause, resume, playFile } = usePlayerStore.getState();
                if (status.state === 'Playing') {
                    pause();
                } else if (status.state === 'Paused') {
                    resume();
                } else if (status.state === 'Stopped' && status.track) {
                    playFile(status.track.path);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 3. Lyrics Fetcher
    const fetchLyrics = useLyricsStore(state => state.fetchLyrics);
    // Subscribe to track changes efficiently
    const trackPath = usePlayerStore(state => state.status.track?.path);
    const trackTitle = usePlayerStore(state => state.status.track?.title);
    const trackArtist = usePlayerStore(state => state.status.track?.artist);
    const trackDuration = usePlayerStore(state => state.status.track?.duration_secs);

    useEffect(() => {
        if (trackPath) {
            console.log('[Lyrics] Global trigger for:', trackTitle);
            fetchLyrics(
                trackArtist || '',
                trackTitle || '',
                trackDuration || 0,
                trackPath
            );
        }
    }, [trackPath, trackTitle, trackArtist, trackDuration, fetchLyrics]);

    // 4. Autoplay Logic — uses interval polling to avoid re-rendering on every position_secs update
    const lastTrackPathRef = useRef<string | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            const { status, repeatMode, nextTrack, getCurrentTrackIndex, queue, playRandomAlbum, pause, playFile } = usePlayerStore.getState();
            const autoplay = useSettingsStore.getState().autoplay;
            const { position_secs, track, state: activeState } = status;
            const duration_secs = track?.duration_secs || 0;
            const activePath = track?.path;

            if (activeState !== 'Playing' || duration_secs <= 0) return;

            if (position_secs >= duration_secs - 0.5) {
                if (lastTrackPathRef.current === activePath) return;
                lastTrackPathRef.current = activePath || null;

                if (repeatMode === 'one') {
                    if (activePath) playFile(activePath);
                } else if (repeatMode === 'all') {
                    nextTrack();
                } else if (repeatMode === 'off') {
                    const currentIndex = getCurrentTrackIndex();
                    if (currentIndex >= queue.length - 1) {
                        if (autoplay) {
                            playRandomAlbum();
                        } else {
                            pause();
                        }
                    } else {
                        nextTrack();
                    }
                } else if (autoplay) {
                    const currentIndex = getCurrentTrackIndex();
                    if (currentIndex >= queue.length - 1) {
                        playRandomAlbum();
                    } else {
                        nextTrack();
                    }
                }
            }
        }, 1000); // Poll every 1s instead of re-rendering on every position_secs change

        return () => clearInterval(interval);
    }, []);

    // Reset lastTrackPath when track changes
    const activePath = usePlayerStore(state => state.status.track?.path);
    useEffect(() => {
        if (activePath && activePath !== lastTrackPathRef.current) {
            lastTrackPathRef.current = null;
        }
    }, [activePath]);

    // 5. Restore Volume
    useEffect(() => {
        const { savedVolume, setVolume } = usePlayerStore.getState();
        setVolume(savedVolume);
    }, []);

    // 6. Sleep Timer Logic
    useEffect(() => {
        const timer = setInterval(() => {
            const { sleepTimerTarget, setSleepTimer, pause, status } = usePlayerStore.getState();

            if (sleepTimerTarget && Date.now() >= sleepTimerTarget) {
                console.log('[SleepTimer] Timer reached! Pausing playback.');
                if (status.state === 'Playing') {
                    pause();
                }
                setSleepTimer(0); // Clear timer
            }
        }, 5000); // Check every 5 seconds

        return () => clearInterval(timer);
    }, []);

    return null;
}
