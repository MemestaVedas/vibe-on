import { getCurrentWindow } from '@tauri-apps/api/window';
import { useState } from 'react';

export function TitleBar() {
    const appWindow = getCurrentWindow();
    const [isMaximized, setIsMaximized] = useState(false);

    // Update maximize state on mount/change
    // (Optional: listen to window events if needed, but for now simple toggle logic)

    return (
        <div
            data-tauri-drag-region
            className="h-10 flex items-center justify-between px-4 bg-surface text-on-surface select-none z-50 fixed top-0 right-0 left-0 shadow-sm"
        >
            {/* App Name */}
            <div className="text-label-large font-bold tracking-wider opacity-90 pointer-events-none flex items-center gap-2">
                <span className="text-primary text-xl">♪</span> VIBE-ON!
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1">
                {/* Minimize */}
                <button
                    onClick={() => appWindow.minimize()}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
                    title="Minimize"
                >
                    <svg viewBox="0 0 10 10" width="10" height="10">
                        <path d="M2,5 L8,5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>

                {/* Maximize / Restore */}
                <button
                    onClick={() => {
                        appWindow.toggleMaximize();
                        setIsMaximized(!isMaximized); // Optimistic update
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
                    title="Maximize"
                >
                    <svg viewBox="0 0 10 10" width="10" height="10">
                        {isMaximized
                            ? <path d="M2,4 L2,8 L6,8 L6,4 L2,4 M4,2 L4,6 L8,6 L8,2 L4,2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            : <path d="M2,2 L2,8 L8,8 L8,2 L2,2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        }
                    </svg>
                </button>

                {/* Close */}
                <button
                    onClick={() => appWindow.close()}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-error hover:text-on-error transition-colors text-on-surface-variant"
                    title="Close"
                >
                    <svg viewBox="0 0 10 10" width="10" height="10">
                        <path d="M2,2 L8,8 M8,2 L2,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

