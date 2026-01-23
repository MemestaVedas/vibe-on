import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export async function openLyricsWindow() {
    console.log('[LyricsWindow] Attempting to open lyrics window');

    // Check if window already exists
    const label = 'floating_lyrics';
    const existing = await WebviewWindow.getByLabel(label);

    if (existing) {
        console.log('[LyricsWindow] Window exists, focusing');
        await existing.setFocus();
        return;
    }

    console.log('[LyricsWindow] Creating new window');
    const webview = new WebviewWindow(label, {
        url: '/index.html?window=lyrics',
        title: 'Lyrics',
        width: 400,
        height: 600,
        decorations: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: true,
        shadow: true,
        dragDropEnabled: false,
    });

    webview.once('tauri://created', () => {
        console.log('[LyricsWindow] Window created successfully');
    });

    webview.once('tauri://error', (e) => {
        console.error('[LyricsWindow] Error creating window:', e);
    });
}
