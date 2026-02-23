import type { AppView } from '../types';

interface HeaderProps {
    view: AppView;
    onViewChange: (view: AppView) => void;
}

export function Header({ view }: HeaderProps) {


    // For views that have their own immersive layouts, we don't render a static positioned header
    // that takes up flex space. We just render an absolute drag region to allow window dragging.
    // This removes the blank gap that caused the "square outline" inside the rounded window corners.
    const immersiveViews = ['albums', 'artists', 'tracks', 'statistics', 'favorites', 'playlist', 'home'];
    if (immersiveViews.includes(view)) {
        return <header data-tauri-drag-region className="absolute top-0 left-0 right-0 h-10 z-[100]"></header>;
    }



    return (
        <header data-tauri-drag-region className="px-6 py-4">
            <h2 data-tauri-drag-region className="text-headline-small font-semibold">
                {view === 'settings' ? 'Settings' :
                    view === 'torrents' ? 'Downloads' :
                        'Library'}
            </h2>
        </header>
    );
}
