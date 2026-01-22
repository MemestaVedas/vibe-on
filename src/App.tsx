import { TrackList } from './components/TrackList';
import { PlayerBar } from './components/PlayerBar';
import './App.css';

import { useMediaSession } from './hooks/useMediaSession';
import { useState, useEffect } from 'react';
import { usePlayerStore } from './store/playerStore';

import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { RightPanel } from './components/RightPanel';
import { AlbumGrid } from './components/AlbumGrid';
import { ArtistList } from './components/ArtistList';
import { SettingsPage } from './components/SettingsPage';
import { AmbientBackground } from './components/AmbientBackground';
import { LyricsPanel } from './components/LyricsPanel';
import { ThemeManager } from './components/ThemeManager';

function App() {
  useMediaSession(); // Initialize System Media Controls
  const { loadLibrary, status, pause, resume, playFile } = usePlayerStore();
  const [view, setView] = useState<'tracks' | 'albums' | 'artists' | 'settings'>('tracks');

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Global spacebar play/pause handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scroll
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
  }, [status.state, status.track, pause, resume, playFile]);

  // Listen for Native Windows Media Events
  useEffect(() => {
    import('@tauri-apps/api/event').then(({ listen }) => {
      const unlisten = Promise.all([
        listen('media:play', () => resume()),
        listen('media:pause', () => pause()),
        listen('media:next', () => usePlayerStore.getState().nextTrack()), // Use getState to avoid dependency cycle/stale closure
        listen('media:prev', () => usePlayerStore.getState().prevTrack()),
        listen('media:stop', () => usePlayerStore.getState().stop()),
      ]);

      return () => {
        unlisten.then(unlisteners => unlisteners.forEach(u => u()));
      };
    });
  }, [resume, pause]); // Dependencies logic handled inside or via getState

  return (
    <div className="flex h-screen overflow-hidden relative">
      <ThemeManager />
      <AmbientBackground />
      <TitleBar />

      {/* Left Sidebar */}
      <div className="relative z-10 backdrop-blur-xl bg-black/30 border-r border-white/5 h-full">
        <Sidebar view={view} onViewChange={setView} />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header Area with drag region */}
        <div data-tauri-drag-region className="h-14 flex items-center px-6 border-b border-white/5 select-none bg-black/10 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white">
            {view === 'tracks' ? 'All Songs' : view === 'albums' ? 'Albums' : 'Artists'}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'tracks' && <TrackList />}
          {view === 'albums' && <AlbumGrid />}
          {view === 'artists' && <ArtistList />}
          {view === 'settings' && <SettingsPage />}
        </div>
      </main>

      {/* Right Panel */}
      <div className="relative z-10 backdrop-blur-xl bg-black/30 border-l border-white/5 h-full">
        <RightPanel />
      </div>

      {/* Player Bar */}
      <PlayerBar />

      {/* Lyrics Panel Overlay */}
      <LyricsPanel />
    </div>
  );
}

export default App;
