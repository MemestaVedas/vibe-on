
interface HeaderProps {
    view: 'tracks' | 'albums' | 'artists' | 'settings' | 'ytmusic';
    onViewChange: (view: 'tracks' | 'albums' | 'artists' | 'settings' | 'ytmusic') => void;
}

export function Header({ view }: HeaderProps) {
    return (
        <header data-tauri-drag-region>
            <h2 data-tauri-drag-region>
                {view === 'tracks' ? 'All Songs' : view === 'albums' ? 'Albums' : view === 'artists' ? 'Artists' : view === 'settings' ? 'Settings' : 'Online'}
            </h2>
        </header>
    );
}
