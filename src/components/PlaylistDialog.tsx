import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePlaylistStore } from '../store/playlistStore';
import { useToastStore } from '../store/toastStore';

export function PlaylistDialog() {
    const { isCreateDialogOpen, closeCreateDialog, createPlaylist, pendingTrackToAdd, addTrackToPlaylist } = usePlaylistStore();
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const showToast = useToastStore(s => s.showToast);

    // Focus input when dialog opens
    useEffect(() => {
        if (isCreateDialogOpen) {
            setName('');
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isCreateDialogOpen]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            const id = await createPlaylist(name);
            if (id) {
                if (pendingTrackToAdd) {
                    await addTrackToPlaylist(id, pendingTrackToAdd);
                    showToast(`Created "${name}" and added track`);
                } else {
                    showToast(`Created playlist "${name}"`);
                }
                closeCreateDialog();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isCreateDialogOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeCreateDialog}
                        className="absolute inset-0 bg-black/40"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
                        className="relative w-full max-w-sm bg-surface-container-high rounded-[32px] p-6 shadow-elevation-4 border border-outline-variant/10 overflow-hidden"
                    >
                        {/* Decorative Background Shape */}
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
                        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-secondary/5 rounded-full blur-3xl" />

                        <div className="relative z-10">
                            <h2 className="text-headline-medium font-bold text-on-surface mb-2">New Playlist</h2>
                            <p className="text-body-medium text-on-surface-variant mb-6">
                                Give your playlist a name to get started.
                            </p>

                            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                                <div className="relative group">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder=" "
                                        className="peer w-full h-16 px-6 rounded-2xl bg-surface-container-highest text-on-surface text-body-large outline-none border-2 border-transparent focus:border-primary/50 transition-all placeholder-shown:pt-0 pt-4"
                                    />
                                    <label className="absolute left-6 top-5 text-on-surface-variant/70 text-body-large pointer-events-none transition-all peer-focus:top-2 peer-focus:text-label-small peer-focus:text-primary peer-focus:opacity-100 peer[:not(:placeholder-shown)]:top-2 peer[:not(:placeholder-shown)]:text-label-small peer[:not(:placeholder-shown)]:opacity-70">
                                        Playlist Name
                                    </label>
                                </div>

                                <div className="flex gap-3 justify-end">
                                    <button
                                        type="button"
                                        onClick={closeCreateDialog}
                                        className="h-12 px-6 rounded-full text-label-large font-medium text-primary hover:bg-primary/10 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!name.trim() || isSubmitting}
                                        className="h-12 px-8 rounded-full bg-primary text-on-primary text-label-large font-bold shadow-sm hover:shadow-md hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none bg-gradient-to-br from-primary to-tertiary"
                                    >
                                        {isSubmitting ? (
                                            <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                                        ) : (
                                            'Create'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
