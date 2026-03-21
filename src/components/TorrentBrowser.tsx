import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { downloadDir } from '@tauri-apps/api/path';
import { TorrentSearch } from './TorrentSearch';
import { motion, AnimatePresence } from 'motion/react';

interface TorrentFile {
    index: number;
    name: string;
    path: string;
    size: number;
    is_audio: boolean;
}

interface InspectResult {
    name: string;
    files: TorrentFile[];
}

interface Props {
    onAdded: () => void;
    isBackendReady: boolean;
}

export function TorrentBrowser({ onAdded, isBackendReady }: Props) {
    const [step, setStep] = useState<'input' | 'inspecting' | 'selection'>('input');
    const [inputType, setInputType] = useState<'search' | 'magnet' | 'file'>('search');
    const [magnetLink, setMagnetLink] = useState('');
    const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
    const [fileName, setFileName] = useState('');
    const [torrentName, setTorrentName] = useState('');

    const [files, setFiles] = useState<TorrentFile[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [downloadPath, setDownloadPath] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);

    // Initialize (similar to useEffect on open)
    useEffect(() => {
        const initPath = async () => {
            const configuredPath = await import('../store/settingsStore').then(m => m.useSettingsStore.getState().downloadPath);

            if (configuredPath) {
                setDownloadPath(configuredPath);
            } else {
                try {
                    const baseDownloadDir = await downloadDir();
                    setDownloadPath(`${baseDownloadDir}vibe-on-music/`);
                } catch {
                    setDownloadPath('');
                }
            }
        };
        initPath();
    }, []);

    const handleFileSelect = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'Torrent Files', extensions: ['torrent'] }]
            });
            if (selected && typeof selected === 'string') {
                const { readFile } = await import('@tauri-apps/plugin-fs');
                const bytes = await readFile(selected);
                setFileBytes(bytes);
                setFileName(selected.split('/').pop() || 'Selected File');
            }
        } catch (e) {
            setError('Failed to read file: ' + String(e));
        }
    };

    const handleInspect = async (magnetOverride?: string) => {
        if (!isBackendReady) {
            setError('Torrent backend is still starting. Please wait a moment and try again.');
            return;
        }

        setStep('inspecting');
        setError(null);
        try {
            let result: InspectResult;
            if (inputType === 'magnet' || (inputType === 'search' && magnetOverride)) {
                const mag = magnetOverride || magnetLink;
                if (!mag) throw new Error("Magnet link required");
                // Update state if it was an override
                if (magnetOverride) {
                    setMagnetLink(magnetOverride);
                    setInputType('magnet');
                }
                result = await invoke<InspectResult>('inspect_magnet', { magnet: mag });
            } else {
                if (!fileBytes) throw new Error("File required");
                result = await invoke<InspectResult>('inspect_torrent_file', { data: Array.from(fileBytes) });
            }
            setTorrentName(result.name);
            setFiles(result.files);
            // Select only audio files by default
            const audioIndices = result.files.filter(f => f.is_audio).map(f => f.index);
            setSelectedIndices(audioIndices.length > 0 ? audioIndices : result.files.map(f => f.index));
            setStep('selection');
        } catch (e) {
            setError(String(e));
            setStep('input');
        }
    };

    const handleBrowsePath = async () => {
        try {
            const selected = await open({
                directory: true,
                defaultPath: downloadPath || undefined,
            });
            if (selected && typeof selected === 'string') {
                // Ensure path ends with slash
                setDownloadPath(selected.endsWith('/') ? selected : selected + '/');
            }
        } catch (e) {
            console.error('Failed to select path:', e);
        }
    };

    const handleStartDownload = async () => {
        if (!isBackendReady) {
            setError('Torrent backend is still starting. Please wait a moment and try again.');
            return;
        }

        if (selectedIndices.length === 0) {
            setError('Please select at least one file to download');
            return;
        }

        setIsStarting(true);
        setError(null);

        try {
            // Sanitize torrent name for folder usage
            const safeName = torrentName.replace(/[<>:"/\\|?*]/g, '_').trim();
            const fullPath = downloadPath.replace(/[\\/]$/, '') + '/' + safeName;

            await invoke('add_torrent_with_options', {
                magnet: inputType === 'magnet' || inputType === 'search' ? magnetLink : null,
                fileBytes: inputType === 'file' && fileBytes ? Array.from(fileBytes) : null,
                path: fullPath,
                selectedFiles: selectedIndices,
            });
            onAdded();

            // Reset state after adding
            setStep('input');
            setMagnetLink('');
            setFileBytes(null);
            setFileName('');
            setTorrentName('');
            setFiles([]);
            setSelectedIndices([]);
        } catch (e) {
            setError(String(e));
            setIsStarting(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const audioFileCount = files.filter(f => f.is_audio).length;
    const selectedAudioCount = files.filter(f => f.is_audio && selectedIndices.includes(f.index)).length;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Steps & Navigation (embedded in content) */}
            {step === 'selection' && (
                <div className="shrink-0 mb-4 px-1">
                    <button
                        onClick={() => setStep('input')}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Search
                    </button>
                </div>
            )}

            {/* Persistent Input View (Search/Magnet/File) */}
            <div className={`flex-1 flex flex-col overflow-hidden ${(step === 'selection' || step === 'inspecting') ? 'pointer-events-none' : ''} transition-all duration-300`}>
                {!isBackendReady && (
                    <div className="mb-4 p-3 bg-surface-container-high text-on-surface-variant rounded-xl border border-outline-variant/20 text-sm">
                        Preparing torrent backend. Search works now, but adding/inspecting torrents will be available in a moment.
                    </div>
                )}

                <div className="flex gap-3 p-1 w-fit mb-6">
                    <button
                        onClick={() => setInputType('search')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${inputType === 'search'
                            ? 'bg-primary text-on-primary ring-2 ring-primary/20'
                            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                            }`}
                    >
                        Search
                    </button>
                    <button
                        onClick={() => setInputType('magnet')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${inputType === 'magnet'
                            ? 'bg-primary text-on-primary ring-2 ring-primary/20'
                            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                            }`}
                    >
                        Magnet Link
                    </button>
                    <button
                        onClick={() => setInputType('file')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${inputType === 'file'
                            ? 'bg-primary text-on-primary ring-2 ring-primary/20'
                            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                            }`}
                    >
                        Torrent File
                    </button>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {inputType === 'search' && (
                        <TorrentSearch onSelectMagnet={(magnet) => handleInspect(magnet)} />
                    )}

                    {inputType === 'magnet' && (
                        <div className="space-y-4 max-w-2xl">
                            <label className="text-sm font-medium text-on-surface-variant">Magnet Link</label>
                            <textarea
                                value={magnetLink}
                                onChange={(e) => setMagnetLink(e.target.value)}
                                placeholder="magnet:?xt=urn:btih:..."
                                className="w-full h-32 px-4 py-3 rounded-xl bg-surface-container-high text-on-surface border-none focus:ring-2 focus:ring-primary outline-none resize-none"
                            />
                            <div className="bg-surface-container-highest p-4 rounded-xl text-sm text-on-surface-variant">
                                Paste a magnet link above to start inspecting the torrent metadata.
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => handleInspect()}
                                    disabled={!magnetLink || !isBackendReady}
                                    className="px-6 py-2 bg-primary text-on-primary rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    Inspect
                                </button>
                            </div>
                        </div>
                    )}

                    {inputType === 'file' && (
                        <div className="space-y-4 max-w-2xl">
                            <label className="text-sm font-medium text-on-surface-variant">Torrent File</label>
                            <div
                                onClick={handleFileSelect}
                                className="w-full h-48 border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-colors"
                            >
                                {fileName ? (
                                    <div className="text-primary font-medium flex flex-col items-center">
                                        <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        {fileName}
                                    </div>
                                ) : (
                                    <>
                                        <svg className="w-8 h-8 text-on-surface-variant mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <span className="text-on-surface-variant">Click to select .torrent file</span>
                                    </>
                                )}
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => handleInspect()}
                                    disabled={!fileBytes || !isBackendReady}
                                    className="px-6 py-2 bg-primary text-on-primary rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    Inspect
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Inspecting Overlay */}
            <AnimatePresence>
                {step === 'inspecting' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center"
                    >
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-white font-medium animate-pulse">Fetching Metadata...</p>
                        <p className="text-sm text-white/60 mt-2">This may take up to a minute for magnet links</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {step === 'selection' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
                        onClick={() => setStep('input')}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-surface rounded-2xl shadow-2xl overflow-hidden border border-white/10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Selection Content */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="p-6 h-full flex flex-col">
                                    {/* Header with Back Button */}
                                    <div className="flex items-center justify-between mb-6 shrink-0">
                                        <button
                                            onClick={() => setStep('input')}
                                            className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                            </svg>
                                            Change Selection
                                        </button>
                                        <button
                                            onClick={() => setStep('input')}
                                            className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant/50 transition-colors"
                                        >
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Torrent Name */}
                                    <div className="mb-6 shrink-0">
                                        <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60 block mb-1">Torrent</label>
                                        <p className="text-xl font-bold text-on-surface truncate" title={torrentName}>{torrentName}</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
                                        {/* Left Column: List */}
                                        <div className="flex flex-col min-h-0">
                                            <div className="flex justify-between items-end mb-3 px-2">
                                                <div>
                                                    <label className="text-sm font-bold text-on-surface">Files to Download</label>
                                                    <p className="text-xs text-on-surface-variant">
                                                        {selectedIndices.length} of {files.length} selected
                                                        {audioFileCount > 0 && (
                                                            <span className="ml-2 text-primary font-medium">• {selectedAudioCount} audio</span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (selectedIndices.length === files.length) setSelectedIndices([]);
                                                            else setSelectedIndices(files.map(f => f.index));
                                                        }}
                                                        className="text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-colors"
                                                    >
                                                        {selectedIndices.length === files.length ? 'Deselect All' : 'Select All'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex-1 overflow-y-auto rounded-2xl bg-surface-container-low p-2 no-scrollbar border border-outline-variant/10">
                                                {files.map((file) => {
                                                    const isSelected = selectedIndices.includes(file.index);
                                                    return (
                                                        <div
                                                            key={file.index}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (isSelected) setSelectedIndices(selectedIndices.filter(i => i !== file.index));
                                                                else setSelectedIndices([...selectedIndices, file.index]);
                                                            }}
                                                            className={`
                                                                group flex items-center gap-3 p-3 mb-1.5 last:mb-0 rounded-xl border transition-all duration-200 cursor-pointer
                                                                ${isSelected
                                                                    ? 'bg-secondary-container/30 border-secondary-container/50'
                                                                    : 'bg-transparent hover:bg-surface-container border-transparent'
                                                                }
                                                            `}
                                                        >
                                                            <div className={`
                                                                w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0
                                                                ${isSelected ? 'bg-primary border-primary' : 'border-outline group-hover:border-primary'}
                                                            `}>
                                                                {isSelected && (
                                                                    <svg className="w-3.5 h-3.5 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                )}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className={`text-sm font-medium truncate ${isSelected ? 'text-on-secondary-container' : 'text-on-surface'}`}>
                                                                    {file.name}
                                                                </div>
                                                                <div className="text-[11px] text-on-surface-variant flex gap-2">
                                                                    <span>{formatSize(file.size)}</span>
                                                                    {file.is_audio && <span className="text-primary font-bold">AUDIO</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Right Column: Options & Path */}
                                        <div className="flex flex-col gap-6">
                                            <div className="space-y-3 p-4 bg-surface-container-high rounded-2xl border border-outline-variant/10">
                                                <label className="text-sm font-bold text-on-surface block">Download Settings</label>

                                                <div className="space-y-2">
                                                    <label className="text-xs font-medium text-on-surface-variant">Destination Path</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            readOnly
                                                            value={downloadPath}
                                                            className="flex-1 px-3 py-2 rounded-xl bg-surface-container text-on-surface text-xs border-none outline-none opacity-80"
                                                        />
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleBrowsePath(); }}
                                                            className="px-3 py-2 bg-surface-container-highest text-on-surface rounded-xl hover:bg-primary hover:text-on-primary transition-all text-xs font-bold"
                                                        >
                                                            Browse
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="pt-4 mt-4 border-t border-outline-variant/20">
                                                    <div className="flex justify-between items-center text-sm font-medium mb-4">
                                                        <span className="text-on-surface-variant">Total Selected Size</span>
                                                        <span className="text-on-surface font-bold text-lg">
                                                            {formatSize(files.filter(f => selectedIndices.includes(f.index)).reduce((acc, f) => acc + f.size, 0))}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleStartDownload(); }}
                                                        disabled={selectedIndices.length === 0 || isStarting || !isBackendReady}
                                                        className="w-full py-4 bg-primary text-on-primary rounded-2xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-primary/20"
                                                    >
                                                        {isStarting ? (
                                                            <>
                                                                <div className="w-5 h-5 border-3 border-on-primary border-t-transparent rounded-full animate-spin" />
                                                                Starting Download...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                </svg>
                                                                Start Download
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-auto p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                                <div className="flex gap-3 text-primary text-sm leading-snug">
                                                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <p>
                                                        Your download will be added to the queue Background processing is active.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {error && (
                <div className="mt-4 p-3 bg-error/10 text-error text-sm rounded-lg border border-error/10 shrink-0">
                    {error}
                </div>
            )}
        </div>
    );
}
