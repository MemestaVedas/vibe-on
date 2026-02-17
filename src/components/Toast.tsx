import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '../store/toastStore';
import { IconCheck } from './Icons';

export function Toast() {
    const { message, isVisible, hideToast } = useToastStore();

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="fixed top-8 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 px-6 py-4 bg-inverse-surface text-inverse-on-surface rounded-full shadow-elevation-3 cursor-pointer"
                    onClick={hideToast}
                >
                    <IconCheck size={20} className="text-inverse-primary" />
                    <span className="text-label-large font-medium">{message}</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
