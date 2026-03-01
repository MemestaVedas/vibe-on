import { motion } from 'motion/react';
import type { SearchResult } from './TorrentSearch';

interface TorrentDetails {
    description_html: string;
    files_html: string;
}

interface Props {
    torrent: SearchResult;
    details: TorrentDetails | null;
    isLoading: boolean;
    error: string | null;
    onClose: () => void;
    onDownload: () => void;
}

export function TorrentDetailsModal({ torrent, details, isLoading, error, onClose, onDownload }: Props) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-surface rounded-2xl shadow-2xl overflow-hidden border border-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-surface-variant/30 shrink-0 bg-surface-container-high">
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-0.5 text-xs font-bold rounded bg-primary/20 text-primary uppercase tracking-wider">
                                {torrent.category}
                            </span>
                            <span className="text-sm text-on-surface-variant">{torrent.date}</span>
                        </div>
                        <h2 className="text-xl font-bold text-on-surface leading-tight break-words">
                            {torrent.title}
                        </h2>

                        <div className="flex items-center gap-6 mt-4 text-sm">
                            <span className="flex items-center gap-1.5 text-on-surface-variant">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                </svg>
                                {torrent.size}
                            </span>
                            <span className="flex items-center gap-1.5 text-green-500 font-medium">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                </svg>
                                {torrent.seeds} Seeds
                            </span>
                            <span className="flex items-center gap-1.5 text-red-500 font-medium">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                                {torrent.leechers} Leechers
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant/50 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-surface">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
                            <svg className="w-10 h-10 mb-4 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="animate-pulse">Fetching details from Nyaa...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-error/10 text-error rounded-xl border border-error/20">
                            <p className="font-bold mb-1">Failed to load details</p>
                            <p className="opacity-80 text-sm">{error}</p>
                        </div>
                    ) : details ? (
                        <div className="space-y-8 nyaa-content">
                            <div>
                                <h3 className="text-lg font-bold text-on-surface mb-4 pb-2 border-b border-surface-variant/30">Description</h3>
                                <div
                                    className="prose prose-invert max-w-none text-on-surface-variant text-sm"
                                    dangerouslySetInnerHTML={{
                                        __html: details.description_html.replace(
                                            /!\[(.*?)\]\((.*?)\)/g,
                                            '<img src="$2" alt="$1" class="max-w-full rounded-lg border border-surface-variant/30 my-4 inline-block" />'
                                        )
                                    }}
                                />
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-on-surface mb-4 pb-2 border-b border-surface-variant/30">Files</h3>
                                <div
                                    className="torrent-files-wrapper text-sm"
                                    dangerouslySetInnerHTML={{ __html: details.files_html }}
                                />
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-surface-variant/30 shrink-0 bg-surface-container flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-on-surface-variant hover:text-on-surface rounded-xl hover:bg-surface-variant/50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onDownload}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Torrent
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
