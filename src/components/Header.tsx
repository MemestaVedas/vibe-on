import { open } from '@tauri-apps/plugin-dialog';
import { usePlayerStore } from '../store/playerStore';
import './Header.css';

interface HeaderProps {
    view: 'tracks' | 'albums';
    onViewChange: (view: 'tracks' | 'albums') => void;
}

export function Header({ view, onViewChange }: HeaderProps) {
    const { scanFolder, currentFolder, library, error, setError } = usePlayerStore();

    const handleOpenFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Select Music Folder',
            });

            if (selected && typeof selected === 'string') {
                await scanFolder(selected);
            }
        } catch (e) {
            console.error('Failed to open folder:', e);
            setError(String(e));
        }
    };

    return (
        <header className="header">

            <div className="header-actions">
                <div className="view-toggle">
                    <button
                        className={`toggle-btn ${view === 'tracks' ? 'active' : ''}`}
                        onClick={() => onViewChange('tracks')}
                    >
                        Tracks
                    </button>
                    <button
                        className={`toggle-btn ${view === 'albums' ? 'active' : ''}`}
                        onClick={() => onViewChange('albums')}
                    >
                        Albums
                    </button>
                </div>
                {currentFolder && (
                    <div className="folder-info">
                        <span className="folder-path">{currentFolder.split('\\').pop()}</span>
                        <span className="track-count">{library.length} tracks</span>
                    </div>
                )}
                <button className="open-folder-btn" onClick={handleOpenFolder}>
                    📁 Open Folder
                </button>
            </div>

            {error && (
                <div className="error-toast" onClick={() => setError(null)}>
                    ⚠️ {error}
                </div>
            )}
        </header>
    );
}
