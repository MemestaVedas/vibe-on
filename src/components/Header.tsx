
interface HeaderProps {
    view: 'tracks' | 'albums' | 'artists' | 'settings' | 'ytmusic' | 'favorites' | 'statistics';
    onViewChange: (view: 'tracks' | 'albums' | 'artists' | 'settings' | 'ytmusic' | 'favorites' | 'statistics') => void;
}

export function Header({ view }: HeaderProps) {
    // For tracks view, show minimal header (search is in TitleBar now)
    if (view === 'tracks') {
        return <header data-tauri-drag-region className="h-4"></header>;
    }

    // For albums/artists views, show title (search is in TitleBar now)
    if (view === 'albums' || view === 'artists') {
        return (
            <header data-tauri-drag-region className="px-6 py-4">
                <h2 data-tauri-drag-region className="text-headline-small font-semibold">
                    {view === 'albums' ? 'Albums' : 'Artists'}
                </h2>
            </header>
        );
    }

    // For settings/ytmusic, just show title
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
