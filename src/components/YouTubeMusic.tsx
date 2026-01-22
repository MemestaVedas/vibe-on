
import { useEffect, useRef, useLayoutEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function YouTubeMusic() {
    const containerRef = useRef<HTMLDivElement>(null);

    const updateBounds = async () => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const win = getCurrentWindow();
        const factor = await win.scaleFactor();

        // New Logic: Child Webview expects coordinates RELATIVE to the parent window's CONTENT area.
        // rect.x / rect.y are relative to the viewport (client area).
        // So we just need to convert them to Physical Pixels using the scale factor.
        // No need to add window position.

        const x = Math.round(rect.x * factor);
        const y = Math.round(rect.y * factor);
        const width = Math.round(rect.width * factor);
        const height = Math.round(rect.height * factor);

        invoke('move_yt_window', { x, y, width, height }).catch(console.error);
    };

    useLayoutEffect(() => {
        // Initial Open and Show
        const init = async () => {
            await invoke('open_yt_music', { width: 800, height: 600 }); // Dims will be fixed by updateBounds immediately
            await invoke('set_yt_visibility', { show: true });
            updateBounds();
        };
        init();

        // Cleanup: Hide on unmount
        return () => {
            invoke('set_yt_visibility', { show: false }).catch(console.error);
        };
    }, []);

    // Handle Resizing
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            updateBounds();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        // Also listen to window move/resize? 
        // Tauri doesn't easily expose "move" event to webview without listener setup.
        // But IF the parent window moves, the child window (if top-level) WON'T move automatically unless parented.
        // Since we didn't strictly "parent" it in backend (just separate window), it might lag or stay put.
        // This is a limitation of the "Separate Window" approach.
        // However, we can try to "dock" it by polling or using a hook. 
        // For MVP, measuring on interval might be safer if we expect window movement.

        const interval = setInterval(updateBounds, 100);

        return () => {
            resizeObserver.disconnect();
            clearInterval(interval);
        };
    }, []);

    const handleControl = (action: string) => {
        invoke('yt_control', { action, value: null }).catch(console.error);
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Custom Toolbar Overlay */}
            <div className="h-12 flex items-center px-4 gap-4 bg-black/20 backdrop-blur-md border-b border-white/5 z-50">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleControl('back')}
                        className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                        title="Go Back"
                    >
                        ←
                    </button>
                    <button
                        onClick={() => handleControl('forward')}
                        className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                        title="Go Forward"
                    >
                        →
                    </button>
                    <button
                        onClick={() => handleControl('home')}
                        className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                        title="Home"
                    >
                        🏠
                    </button>
                </div>
                <div className="flex-1 text-center text-xs text-white/30 font-mono tracking-widest uppercase">
                    YouTube Music Embedded
                </div>
                <div className="w-24" /> {/* Spacer */}
            </div>

            {/* Placeholder area where the window will sit */}
            {/* We make it transparent so we can see the window behind (if we used transparent main window + behind strategy) */}
            {/* OR if we used 'Top Window' strategy (current), this div is just a placeholder for layout calculation. */}
            {/* Since the YT window is ON TOP, it will cover this div. */}
            {/* Accessing usage: Pointer events? */}
            {/* If YT window is on top, it steals events. We can't click "through" it unless we set it to ignore events. */}
            {/* But we WANT to click YT Music. So it's fine. */}
            {/* The toolbar is separate. Wait. If YT Window covers this whole Container, including toolbar? */}
            {/* No, we should effectively place the YT window *below* the toolbar. */}
            <div ref={containerRef} className="flex-1 bg-black/50 rounded-lg m-2 overflow-hidden relative">
                <div className="absolute inset-0 flex items-center justify-center text-white/20 pointer-events-none">
                    Loading YouTube Music...
                </div>
            </div>
        </div>
    );
}
