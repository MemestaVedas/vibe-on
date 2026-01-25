import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { downloadDir } from '@tauri-apps/api/path';
import { motion, AnimatePresence } from 'framer-motion';

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
    isOpen: boolean;
    onClose: () => void;
    onAdded: () => void;
}

export function TorrentAddModal({ isOpen, onClose, onAdded }: Props) {
    const [step, setStep] = useState<'input' | 'inspecting' | 'selection'>('input');
    const [inputType, setInputType] = useState<'magnet' | 'file'>('magnet');
    const [magnetLink, setMagnetLink] = useState('');
    const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
    const [fileName, setFileName] = useState('');
    const [torrentName, setTorrentName] = useState('');

    const [files, setFiles] = useState<TorrentFile[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [downloadPath, setDownloadPath] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            const initPath = async () => {
                try {
                    const baseDownloadDir = await downloadDir();
                    setDownloadPath(`${baseDownloadDir}vibe-on-music/`);
                } catch {
                    setDownloadPath('');
                }
            };
            initPath();
            
            setStep('input');
            setMagnetLink('');
            setFileBytes(null);
            setFileName('');
            setTorrentName('');
            setFiles([]);
            setSelectedIndices([]);
            setError(null);
            setIsStarting(false);
        }
    }, [isOpen]);

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

    const handleInspect = async () => {
        setStep('inspecting');
        setError(null);
        try {
            let result: InspectResult;
            if (inputType === 'magnet') {
                if (!magnetLink) throw new Error("Magnet link required");
                result = await invoke<InspectResult>('inspect_magnet', { magnet: magnetLink });
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
                setDownloadPath(selected);
            }
        } catch (e) {
            console.error('Failed to select path:', e);
        }
    };

    const handleStartDownload = async () => {
        if (selectedIndices.length === 0) {
            setError('Please select at least one file to download');
            return;
        }
        
        setIsStarting(true);
        setError(null);
        
        try {
            await invoke('add_torrent_with_options', {
                magnet: inputType === 'magnet' ? magnetLink : null,
                fileBytes: inputType === 'file' && fileBytes ? Array.from(fileBytes) : null,
                path: downloadPath,
                selectedFiles: selectedIndices.length === files.length ? null : selectedIndices,
            });
            onAdded();
            onClose();
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

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-surface-container rounded-2xl w-[600px] max-h-[80vh] flex flex-col shadow-2xl border border-outline/10"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-outline/10 flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-on-surface">Add New Download</h2>
                        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex-1 overflow-y-auto">
                        {step === 'input' && (
                            <div className="space-y-6">
                                <div className="flex gap-4 p-1 bg-surface-container-highest rounded-xl w-fit">
                                    <button
                                        onClick={() => setInputType('magnet')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${inputType === 'magnet' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                                    >
                                        Magnet Link
                                    </button>
                                    <button
                                        onClick={() => setInputType('file')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${inputType === 'file' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                                    >
                                        Torrent File
                                    </button>
                                </div>

                                {inputType === 'magnet' ? (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-on-surface-variant">Magnet Link</label>
                                        <textarea
                                            value={magnetLink}
                                            onChange={(e) => setMagnetLink(e.target.value)}
                                            placeholder="magnet:?xt=urn:btih:..."
                                            className="w-full h-32 px-4 py-3 rounded-xl bg-surface-container-high text-on-surface border-none focus:ring-2 focus:ring-primary outline-none resize-none"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-on-surface-variant">Torrent File</label>
                                        <div
                                            onClick={handleFileSelect}
                                            className="w-full h-32 border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-colors"
                                        >
                                            {fileName ? (
                                                <div className="text-primary font-medium">{fileName}</div>
                                            ) : (
                                                <>
                                                    <svg className="w-8 h-8 text-on-surface-variant mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                    </svg>
                                                    <span className="text-on-surface-variant">Click to select .torrent file</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 'inspecting' && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-on-surface animate-pulse">Fetching Metadata...</p>
                                <p className="text-sm text-on-surface-variant mt-2">This may take up to a minute for magnet links</p>
                            </div>
                        )}

                        {step === 'selection' && (
                            <div className="space-y-6">
                                {/* Torrent Name */}
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-on-surface-variant">Torrent</label>
                                    <p className="text-on-surface font-medium">{torrentName}</p>
                                </div>

                                {/* Path Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-on-surface-variant">Download Location</label>
                                    <div className="flex gap-2">
                                        <input
                                            readOnly
                                            value={downloadPath}
                                            className="flex-1 px-4 py-2 rounded-xl bg-surface-container-high text-on-surface text-sm border-none outline-none opacity-80"
                                        />
                                        <button
                                            onClick={handleBrowsePath}
                                            className="px-4 py-2 bg-surface-container-highest text-on-surface rounded-xl hover:bg-surface-container-high transition-colors text-sm font-medium"
                                        >
                                            Browse
                                        </button>
                                    </div>
                                </div>

                                {/* File List */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium text-on-surface-variant">
                                            Files ({selectedIndices.length} of {files.length} selected)
                                            {audioFileCount > 0 && (
                                                <span className="ml-2 text-primary">• {selectedAudioCount} audio files</span>
                                            )}
                                        </label>
                                        <div className="flex gap-2">
                                            {audioFileCount > 0 && audioFileCount < files.length && (
                                                <button
                                                    onClick={() => setSelectedIndices(files.filter(f => f.is_audio).map(f => f.index))}
                                                    className="text-xs text-primary hover:underline"
                                                >
                                                    Audio Only
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (selectedIndices.length === files.length) setSelectedIndices([]);
                                                    else setSelectedIndices(files.map(f => f.index));
                                                }}
                                                className="text-xs text-primary hover:underline"
                                            >
                                                {selectedIndices.length === files.length ? 'Deselect All' : 'Select All'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto rounded-xl bg-surface-container-high border border-outline/10 p-2">
                                        {files.map((file) => (
                                            <div 
                                                key={file.index} 
                                                className={`flex items-start gap-3 p-2 hover:bg-surface-container-highest rounded-lg transition-colors ${
                                                    file.is_audio ? 'border-l-2 border-primary' : ''
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIndices.includes(file.index)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedIndices([...selectedIndices, file.index]);
                                                        else setSelectedIndices(selectedIndices.filter(i => i !== file.index));
                                                    }}
                                                    className="mt-1 rounded border-outline text-primary focus:ring-primary"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-on-surface break-words">{file.name}</div>
                                                    <div className="text-xs text-on-surface-variant">{formatSize(file.size)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 p-3 bg-error/10 text-error text-sm rounded-lg border border-error/10">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-outline/10 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-on-surface-variant hover:text-on-surface font-medium"
                        >
                            Cancel
                        </button>
                        {step === 'input' && (
                            <button
                                onClick={handleInspect}
                                disabled={!magnetLink && !fileBytes}
                                className="px-6 py-2 bg-primary text-on-primary rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        )}
                        {step === 'selection' && (
                            <button
                                onClick={handleStartDownload}
                                disabled={selectedIndices.length === 0 || isStarting}
                                className="px-6 py-2 bg-primary text-on-primary rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isStarting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                                        Starting...
                                    </>
                                ) : (
                                    'Start Download'
                                )}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
