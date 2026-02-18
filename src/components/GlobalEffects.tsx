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

    // 4. Autoplay Logic
    const autoplay = useSettingsStore(state => state.autoplay);
    const position_secs = usePlayerStore(state => state.status.position_secs);
    const duration_secs = usePlayerStore(state => state.status.track?.duration_secs || 0);
    const activeState = usePlayerStore(state => state.status.state);
    const activePath = usePlayerStore(state => state.status.track?.path);

    const lastTrackPathRef = useRef<string | null>(null);

    useEffect(() => {
        if (activeState !== 'Playing' || duration_secs <= 0) return;

        if (position_secs >= duration_secs - 0.5) {
            if (lastTrackPathRef.current === activePath) return;

            lastTrackPathRef.current = activePath || null;

            setTimeout(() => {
                const { repeatMode, nextTrack, getCurrentTrackIndex, queue, playRandomAlbum, pause } = usePlayerStore.getState();
                console.log('[Autoplay] Track ended. Repeat:', repeatMode);

                if (repeatMode === 'one') {
                    // handled by PlayerBar effect typically, or backend
                    if (activePath) usePlayerStore.getState().playFile(activePath);
                } else if (repeatMode === 'all') {
                    nextTrack();
                } else if (repeatMode === 'off') {
                    const currentIndex = getCurrentTrackIndex();
                    if (currentIndex >= queue.length - 1) {
                        console.log('[Autoplay] End of queue reached.');
                        if (autoplay) {
                            console.log('[Autoplay] Autoplay enabled, picking random album...');
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
                        console.log('[Autoplay] Queue ended! Picking a random album...');
                        playRandomAlbum();
                    } else {
                        nextTrack();
                    }
                }
            }, 300);
        }
    }, [position_secs, duration_secs, activeState, activePath, autoplay]);

    // Reset lastTrackPath
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
