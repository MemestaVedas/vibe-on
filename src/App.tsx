import { Header } from './components/Header';
import { TrackList } from './components/TrackList';
import { PlayerBar } from './components/PlayerBar';
import './App.css';

import { useState, useEffect } from 'react';
import { usePlayerStore } from './store/playerStore';

import { TitleBar } from './components/TitleBar';

import { AlbumGrid } from './components/AlbumGrid';

function App() {
  const { loadLibrary } = usePlayerStore();
  const [view, setView] = useState<'tracks' | 'albums'>('tracks');

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  return (
    <div className="app">
      <TitleBar />
      <Header view={view} onViewChange={setView} />
      <main className="main-content">
        {view === 'tracks' ? <TrackList /> : <AlbumGrid />}
      </main>
      <PlayerBar />
    </div>
  );
}

export default App;
