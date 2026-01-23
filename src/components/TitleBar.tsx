import { getCurrentWindow } from '@tauri-apps/api/window';
import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { usePlayerStore } from '../store/playerStore';
import { SearchBar } from './SearchBar';

export function TitleBar() {
    const appWindow = getCurrentWindow();
    const [isMaximized, setIsMaximized] = useState(false);
    const [closeHovered, setCloseHovered] = useState(false);
    const [isMacOS, setIsMacOS] = useState(false);
    const scanFolder = usePlayerStore(state => state.scanFolder);

    // Detect OS on mount
    useEffect(() => {
        const platform = navigator.platform.toLowerCase();
        const userAgent = navigator.userAgent.toLowerCase();
        setIsMacOS(platform.includes('mac') || userAgent.includes('mac'));
    }, []);

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
        }
    };

    // Window Controls Component
    const WindowControls = () => (
        <div className={`flex items-center gap-2 ${isMacOS ? 'pl-2' : 'pr-2'}`}>
            {isMacOS ? (
                <>
                    {/* macOS Order: Close, Minimize, Maximize */}
                    {/* Close - M3 4-Sided Cookie Shape - Red fill + glow on hover */}
                    <button
                        onClick={() => appWindow.close()}
                        onMouseEnter={() => setCloseHovered(true)}
                        onMouseLeave={() => setCloseHovered(false)}
                        className="w-4 h-4 group flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 transition-all duration-150"
                        title="Close"
                        style={{ filter: closeHovered ? 'drop-shadow(0 0 6px #ef4444)' : 'none' }}
                    >
                        <svg
                            viewBox="0 0 280 280"
                            className="w-full h-full transition-colors"
                            style={{ color: closeHovered ? '#ef4444' : 'var(--md-sys-color-secondary)' }}
                        >
                            <path d="M178.73 6.2068C238.87 -19.9132 299.91 41.1269 273.79 101.267L269.47 111.207C261.5 129.577 261.5 150.417 269.47 168.787L273.79 178.727C299.91 238.867 238.87 299.907 178.73 273.787L168.79 269.467C150.42 261.497 129.58 261.497 111.21 269.467L101.27 273.787C41.1281 299.907 -19.9139 238.867 6.20706 178.727L10.5261 168.787C18.5011 150.417 18.5011 129.577 10.5261 111.207L6.20706 101.267C-19.9139 41.1269 41.1281 -19.9132 101.27 6.2068L111.21 10.5269C129.58 18.4969 150.42 18.4969 168.79 10.5269L178.73 6.2068Z" fill="currentColor" />
                        </svg>
                    </button>

                    {/* Minimize - M3 Arrow Shape - Uses Tertiary Color */}
                    <button
                        onClick={() => appWindow.minimize()}
                        className="w-4 h-4 group flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 transition-all duration-150"
                        title="Minimize"
                    >
                        <svg viewBox="0 0 316 278" className="w-full h-full transition-colors" style={{ color: 'var(--md-sys-color-tertiary)' }}>
                            <path d="M271.57 155.799C257.552 177.379 243.535 198.989 229.517 220.569C220.423 234.579 211.167 248.778 198.872 259.908C186.576 271.058 170.648 278.938 154.316 277.908C139.976 276.988 126.684 269.278 116.191 259.208C105.698 249.138 97.5464 236.738 89.5284 224.458C67.8424 191.278 46.1303 158.098 24.4443 124.898C14.1393 109.138 3.56535 92.6884 0.713353 73.9084C-2.73065 51.2184 6.55235 28.1085 23.0183 13.0185C40.2373 -2.76147 68.1384 -1.48141 89.0984 2.83859C112.075 7.58859 134.541 16.5185 157.975 16.4885C178.047 16.4885 197.446 9.88858 216.979 5.08859C236.485 0.318604 257.445 -2.62152 276.279 4.47849C299.659 13.2685 316.448 38.2684 315.991 63.9284C315.56 87.3384 302.457 108.248 289.839 127.728C283.758 137.078 277.678 146.449 271.597 155.799H271.57Z" fill="currentColor" />
                        </svg>
                    </button>

                    {/* Maximize - M3 Very Sunny Shape - Uses Primary Color */}
                    <button
                        onClick={() => {
                            appWindow.toggleMaximize();
                            setIsMaximized(!isMaximized);
                        }}
                        className="w-4 h-4 group flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 transition-all duration-150"
                        title="Maximize"
                    >
                        <svg viewBox="0 0 320 320" className="w-full h-full transition-colors" style={{ color: 'var(--md-sys-color-primary)' }}>
                            <path d="M136.72 13.1925C147.26 -4.3975 172.74 -4.3975 183.28 13.1925L195.12 32.9625C201.27 43.2125 213.4 48.2425 224.99 45.3325L247.35 39.7325C267.24 34.7525 285.25 52.7626 280.27 72.6526L274.67 95.0126C271.76 106.603 276.79 118.733 287.04 124.883L306.81 136.723C324.4 147.263 324.4 172.743 306.81 183.283L287.04 195.123C276.79 201.273 271.76 213.403 274.67 224.993L280.27 247.353C285.25 267.243 267.24 285.253 247.35 280.273L224.99 274.673C213.4 271.763 201.27 276.793 195.12 287.043L183.28 306.813C172.74 324.403 147.26 324.403 136.72 306.813L124.88 287.043C118.73 276.793 106.6 271.763 95.0102 274.673L72.6462 280.273C52.7632 285.253 34.7472 267.243 39.7292 247.353L45.3332 224.993C48.2382 213.403 43.2143 201.273 32.9603 195.123L13.1873 183.283C-4.39575 172.743 -4.39575 147.263 13.1873 136.723L32.9603 124.883C43.2143 118.733 48.2382 106.603 45.3332 95.0126L39.7292 72.6526C34.7472 52.7626 52.7633 34.7525 72.6453 39.7325L95.0102 45.3325C106.6 48.2425 118.73 43.2125 124.88 32.9625L136.72 13.1925Z" fill="currentColor" />
                        </svg>
                    </button>
                </>
            ) : (
                <>
                    {/* Windows Order: Minimize, Maximize, Close */}
                    {/* Minimize - M3 Arrow Shape - Uses Tertiary Color */}
                    <button
                        onClick={() => appWindow.minimize()}
                        className="w-4 h-4 group flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 transition-all duration-150"
                        title="Minimize"
                    >
                        <svg viewBox="0 0 316 278" className="w-full h-full transition-colors" style={{ color: 'var(--md-sys-color-tertiary)' }}>
                            <path d="M271.57 155.799C257.552 177.379 243.535 198.989 229.517 220.569C220.423 234.579 211.167 248.778 198.872 259.908C186.576 271.058 170.648 278.938 154.316 277.908C139.976 276.988 126.684 269.278 116.191 259.208C105.698 249.138 97.5464 236.738 89.5284 224.458C67.8424 191.278 46.1303 158.098 24.4443 124.898C14.1393 109.138 3.56535 92.6884 0.713353 73.9084C-2.73065 51.2184 6.55235 28.1085 23.0183 13.0185C40.2373 -2.76147 68.1384 -1.48141 89.0984 2.83859C112.075 7.58859 134.541 16.5185 157.975 16.4885C178.047 16.4885 197.446 9.88858 216.979 5.08859C236.485 0.318604 257.445 -2.62152 276.279 4.47849C299.659 13.2685 316.448 38.2684 315.991 63.9284C315.56 87.3384 302.457 108.248 289.839 127.728C283.758 137.078 277.678 146.449 271.597 155.799H271.57Z" fill="currentColor" />
                        </svg>
                    </button>

                    {/* Maximize - M3 Very Sunny Shape - Uses Primary Color */}
                    <button
                        onClick={() => {
                            appWindow.toggleMaximize();
                            setIsMaximized(!isMaximized);
                        }}
                        className="w-4 h-4 group flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 transition-all duration-150"
                        title="Maximize"
                    >
                        <svg viewBox="0 0 320 320" className="w-full h-full transition-colors" style={{ color: 'var(--md-sys-color-primary)' }}>
                            <path d="M136.72 13.1925C147.26 -4.3975 172.74 -4.3975 183.28 13.1925L195.12 32.9625C201.27 43.2125 213.4 48.2425 224.99 45.3325L247.35 39.7325C267.24 34.7525 285.25 52.7626 280.27 72.6526L274.67 95.0126C271.76 106.603 276.79 118.733 287.04 124.883L306.81 136.723C324.4 147.263 324.4 172.743 306.81 183.283L287.04 195.123C276.79 201.273 271.76 213.403 274.67 224.993L280.27 247.353C285.25 267.243 267.24 285.253 247.35 280.273L224.99 274.673C213.4 271.763 201.27 276.793 195.12 287.043L183.28 306.813C172.74 324.403 147.26 324.403 136.72 306.813L124.88 287.043C118.73 276.793 106.6 271.763 95.0102 274.673L72.6462 280.273C52.7632 285.253 34.7472 267.243 39.7292 247.353L45.3332 224.993C48.2382 213.403 43.2143 201.273 32.9603 195.123L13.1873 183.283C-4.39575 172.743 -4.39575 147.263 13.1873 136.723L32.9603 124.883C43.2143 118.733 48.2382 106.603 45.3332 95.0126L39.7292 72.6526C34.7472 52.7626 52.7633 34.7525 72.6453 39.7325L95.0102 45.3325C106.6 48.2425 118.73 43.2125 124.88 32.9625L136.72 13.1925Z" fill="currentColor" />
                        </svg>
                    </button>

                    {/* Close - M3 4-Sided Cookie Shape - Red fill + glow on hover */}
                    <button
                        onClick={() => appWindow.close()}
                        onMouseEnter={() => setCloseHovered(true)}
                        onMouseLeave={() => setCloseHovered(false)}
                        className="w-4 h-4 group flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 transition-all duration-150"
                        title="Close"
                        style={{ filter: closeHovered ? 'drop-shadow(0 0 6px #ef4444)' : 'none' }}
                    >
                        <svg
                            viewBox="0 0 280 280"
                            className="w-full h-full transition-colors"
                            style={{ color: closeHovered ? '#ef4444' : 'var(--md-sys-color-secondary)' }}
                        >
                            <path d="M178.73 6.2068C238.87 -19.9132 299.91 41.1269 273.79 101.267L269.47 111.207C261.5 129.577 261.5 150.417 269.47 168.787L273.79 178.727C299.91 238.867 238.87 299.907 178.73 273.787L168.79 269.467C150.42 261.497 129.58 261.497 111.21 269.467L101.27 273.787C41.1281 299.907 -19.9139 238.867 6.20706 178.727L10.5261 168.787C18.5011 150.417 18.5011 129.577 10.5261 111.207L6.20706 101.267C-19.9139 41.1269 41.1281 -19.9132 101.27 6.2068L111.21 10.5269C129.58 18.4969 150.42 18.4969 168.79 10.5269L178.73 6.2068Z" fill="currentColor" />
                        </svg>
                    </button>
                </>
            )}
        </div>
    );

    // App Name + Add Folder Button Component
    const AppNameSection = () => (
        <div className="flex items-center gap-3">
            <div className="text-label-large font-bold tracking-wider opacity-90 pointer-events-none flex items-center gap-2">
                <span className="text-primary text-xl">♪</span> VIBE-ON!
            </div>

            {/* Add Folder Button - M3 Rounded Square Shape */}
            <button
                onClick={handleOpenFolder}
                className="w-5 h-5 group flex items-center justify-center relative opacity-70 hover:opacity-100 hover:scale-110 transition-all duration-150"
                title="Add Folder"
            >
                <svg viewBox="0 0 320 320" className="absolute w-full h-full transition-colors" style={{ color: 'var(--md-sys-color-tertiary-container)' }}>
                    <path d="M320 172C320 216.72 320 239.08 312.98 256.81C302.81 282.49 282.49 302.81 256.81 312.98C239.08 320 216.72 320 172 320H148C103.28 320 80.9199 320 63.1899 312.98C37.5099 302.81 17.19 282.49 7.02002 256.81C1.95503e-05 239.08 0 216.72 0 172V148C0 103.28 1.95503e-05 80.92 7.02002 63.19C17.19 37.515 37.5099 17.187 63.1899 7.02197C80.9199 -2.71797e-05 103.28 0 148 0H172C216.72 0 239.08 -2.71797e-05 256.81 7.02197C282.49 17.187 302.81 37.515 312.98 63.19C320 80.92 320 103.28 320 148V172Z" fill="currentColor" />
                </svg>
                {/* Plus Icon */}
                <svg viewBox="0 0 24 24" width="12" height="12" className="relative z-10 transition-colors" style={{ color: 'var(--md-sys-color-on-tertiary-container)' }}>
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />
                </svg>
            </button>
        </div>
    );

    return (
        <div
            data-tauri-drag-region
            className="h-10 flex items-center justify-between px-4 bg-transparent text-on-surface select-none z-50 fixed top-0 right-0 left-0"
        >
            {/* macOS: Controls on Left, then App Name | Windows: App Name on Left */}
            {isMacOS ? (
                <>
                    <WindowControls />
                    <div className="flex-1 flex justify-center">
                        <SearchBar />
                    </div>
                    <AppNameSection />
                </>
            ) : (
                <>
                    <AppNameSection />
                    <div className="flex-1 flex justify-end pr-8">
                        <SearchBar />
                    </div>
                    <WindowControls />
                </>
            )}
        </div>
    );
}

