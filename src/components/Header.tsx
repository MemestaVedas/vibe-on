import { open } from '@tauri-apps/plugin-dialog';
import { usePlayerStore } from '../store/playerStore';


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
        <header data-tauri-drag-region className="flex items-center justify-between pl-6 pr-20 pt-5 pb-3 relative z-10 select-none">
            {/* Left side - empty for balance */}
            <div className="flex-1" />


            <div className="flex items-center gap-4">
                <div className="flex bg-white/10 rounded-lg p-1 gap-1 backdrop-blur-md">
                    <button
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${view === 'tracks' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                        onClick={() => onViewChange('tracks')}
                    >
                        Tracks
                    </button>
                    <button
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${view === 'albums' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                        onClick={() => onViewChange('albums')}
                    >
                        Albums
                    </button>
                </div>
                {currentFolder && (
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="text-sm font-medium text-white/80">{currentFolder.split('\\').pop()}</span>
                        <span className="text-[10px] text-white/50">{library.length} tracks</span>
                    </div>
                )}
                <button
                    className="px-5 py-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-semibold shadow-lg hover:-translate-y-0.5 hover:shadow-indigo-500/30 transition-all duration-200 active:translate-y-0 active:scale-95"
                    onClick={handleOpenFolder}
                >
                    Open Folder
                </button>
            </div>

            {error && (
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm shadow-xl backdrop-blur-md cursor-pointer animate-bounce z-50" onClick={() => setError(null)}>
                    ⚠️ {error}
                </div>
            )}
        </header>
    );
}
