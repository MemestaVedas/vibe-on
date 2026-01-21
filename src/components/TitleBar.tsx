import { getCurrentWindow } from '@tauri-apps/api/window';
import './TitleBar.css';

export function TitleBar() {
    const appWindow = getCurrentWindow();

    return (
        <div data-tauri-drag-region className="titlebar">
            <div className="titlebar-buttons">
                <div className="titlebar-button close" onClick={() => appWindow.close()}>
                    <svg viewBox="0 0 10 10"><path d="M2,2 L8,8 M8,2 L2,8" stroke="currentColor" strokeWidth="1.2" /></svg>
                </div>
                <div className="titlebar-button minimize" onClick={() => appWindow.minimize()}>
                    <svg viewBox="0 0 10 10"><path d="M2,5 L8,5" stroke="currentColor" strokeWidth="1.2" /></svg>
                </div>
                <div className="titlebar-button maximize" onClick={() => appWindow.toggleMaximize()}>
                    <svg viewBox="0 0 10 10"><path d="M1,1 L9,1 L9,9 L1,9 Z" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
                </div>
            </div>
            <div className="titlebar-title" data-tauri-drag-region>Vibe</div>
            <div className="titlebar-placeholder" />
        </div>
    );
}
