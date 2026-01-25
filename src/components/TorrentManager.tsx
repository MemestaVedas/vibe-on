import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TorrentAddModal } from './TorrentAddModal';
import { downloadDir } from '@tauri-apps/api/path';

interface TorrentStatus {
    id: number;
    name: string;
    progress: number;
    download_speed: number;
    upload_speed: number;
    state: string;
    total_size: number;
    downloaded_size: number;
    peers_connected: number;
    error: string | null;
}

export function TorrentManager() {
    const [torrents, setTorrents] = useState<TorrentStatus[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);

    const fetchTorrents = async () => {
        try {
            const list = await invoke<TorrentStatus[]>('get_torrents');
            setTorrents(list);
        } catch (e) {
            console.error("Failed to fetch torrents", e);
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                // Use Tauri's downloadDir which handles permissions properly
                const baseDownloadDir = await downloadDir();
                const torrentDir = `${baseDownloadDir}vibe-on-music/`;
                
                await invoke('init_torrent_backend', { downloadDir: torrentDir });
                setIsInitialized(true);
                setInitError(null);
                fetchTorrents();
            } catch (e) {
                console.error("Failed to initialize torrent backend:", e);
                setInitError(String(e));
            }
        };
        init();

        const interval = setInterval(() => {
            if (isInitialized) {
                fetchTorrents();
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [isInitialized]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatSpeed = (bytesPerSec: number) => {
        if (bytesPerSec === 0) return '0 B/s';
        return formatSize(bytesPerSec) + '/s';
    };

    const handlePause = async (id: number) => {
        try {
            await invoke('pause_torrent', { id });
            fetchTorrents();
        } catch (e) {
            console.error("Failed to pause torrent:", e);
        }
    };

    const handleResume = async (id: number) => {
        try {
            await invoke('resume_torrent', { id });
            fetchTorrents();
        } catch (e) {
            console.error("Failed to resume torrent:", e);
        }
    };

    const handleDelete = async (id: number) => {
        if (confirm('Delete torrent and downloaded files?')) {
            try {
                await invoke('delete_torrent', { id, deleteFiles: true });
                fetchTorrents();
            } catch (e) {
                console.error("Failed to delete torrent:", e);
            }
        }
    };

    return (
        <div className="h-full flex flex-col p-8 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-on-surface">Downloads</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={!isInitialized}
                    className="px-6 py-3 bg-primary text-on-primary font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Torrent
                </button>
            </div>

            {/* Error State */}
            {initError && (
                <div className="mb-4 p-4 bg-error/10 text-error rounded-xl border border-error/20">
                    <p className="font-medium">Failed to initialize torrent backend</p>
                    <p className="text-sm opacity-80">{initError}</p>
                </div>
            )}

            {/* Torrents List */}
            <div className="flex-1 overflow-y-auto rounded-2xl bg-surface-container-low border border-outline-variant/20">
                {torrents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-50 text-on-surface-variant">
                        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <p>No active downloads</p>
                        <p className="text-sm mt-2">Click "Add Torrent" to start downloading music</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-surface-container sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-medium text-on-surface-variant text-sm uppercase tracking-wider">Name</th>
                                <th className="p-4 font-medium text-on-surface-variant text-sm uppercase tracking-wider">Size</th>
                                <th className="p-4 font-medium text-on-surface-variant text-sm uppercase tracking-wider w-1/4">Progress</th>
                                <th className="p-4 font-medium text-on-surface-variant text-sm uppercase tracking-wider">Speed</th>
                                <th className="p-4 font-medium text-on-surface-variant text-sm uppercase tracking-wider">Peers</th>
                                <th className="p-4 font-medium text-on-surface-variant text-sm uppercase tracking-wider">State</th>
                                <th className="p-4 font-medium text-on-surface-variant text-sm uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                            {torrents.map((t) => (
                                <tr key={t.id} className="hover:bg-surface-container-high/50 transition-colors">
                                    <td className="p-4 font-medium text-on-surface truncate max-w-[250px]" title={t.name}>
                                        {t.name}
                                        {t.error && (
                                            <span className="block text-xs text-error truncate" title={t.error}>
                                                Error: {t.error}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-on-surface-variant text-sm whitespace-nowrap">
                                        {formatSize(t.downloaded_size)} / {formatSize(t.total_size)}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${
                                                        t.state === 'Finished' ? 'bg-green-500' : 'bg-primary'
                                                    }`}
                                                    style={{ width: `${t.progress * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-sm font-variant-numeric tabular-nums text-on-surface-variant w-12 text-right">
                                                {Math.round(t.progress * 100)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-on-surface-variant text-sm whitespace-nowrap">
                                        {t.state === 'Downloading' ? (
                                            <span className="text-primary">↓ {formatSpeed(t.download_speed)}</span>
                                        ) : (
                                            <span className="opacity-50">—</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-on-surface-variant text-sm">
                                        {t.state === 'Downloading' ? t.peers_connected : '—'}
                                    </td>
                                    <td className="p-4">
                                        <span className={`
                                            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                            ${t.state === 'Finished' ? 'bg-green-500/10 text-green-500' : 
                                              t.state === 'Paused' ? 'bg-yellow-500/10 text-yellow-500' :
                                              t.state === 'Downloading' ? 'bg-blue-500/10 text-blue-500' :
                                              'bg-red-500/10 text-red-500'}
                                        `}>
                                            {t.state}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {t.state === 'Downloading' ? (
                                                <button
                                                    onClick={() => handlePause(t.id)}
                                                    className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-full transition-colors"
                                                    title="Pause"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                                                    </svg>
                                                </button>
                                            ) : t.state === 'Paused' ? (
                                                <button
                                                    onClick={() => handleResume(t.id)}
                                                    className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-full transition-colors"
                                                    title="Resume"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                    </svg>
                                                </button>
                                            ) : null}
                                            
                                            <button
                                                onClick={() => handleDelete(t.id)}
                                                className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-full transition-colors"
                                                title="Delete"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <TorrentAddModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdded={fetchTorrents}
            />
        </div>
    );
}
