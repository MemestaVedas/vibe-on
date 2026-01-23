
interface HeaderProps {
    view: 'tracks' | 'albums' | 'artists' | 'settings' | 'ytmusic' | 'favorites' | 'statistics';
    onViewChange: (view: 'tracks' | 'albums' | 'artists' | 'settings' | 'ytmusic' | 'favorites' | 'statistics') => void;
}

export function Header({ view }: HeaderProps) {
    return (
        <header data-tauri-drag-region>
            <h2 data-tauri-drag-region>
                {view === 'tracks' ? 'All Songs' :
                    view === 'albums' ? 'Albums' :
                        view === 'artists' ? 'Artists' :
                            view === 'favorites' ? 'Favorites' :
                                view === 'statistics' ? 'Statistics' :
                                    view === 'settings' ? 'Settings' :
                                        view === 'ytmusic' ? 'YouTube Music' :
                                            'Library'}
            </h2>
        </header>
    );
}
