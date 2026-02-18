import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Ripple {
    id: number;
    x: number;
    y: number;
    size: number;
}

export function useRipple({ color = 'rgba(255, 255, 255, 0.45)', duration = 1.0, size = 100 }: { color?: string; duration?: number; size?: number } = {}) {
    const [ripples, setRipples] = useState<Ripple[]>([]);

    const trigger = useCallback((e?: React.MouseEvent, containerOverride?: HTMLElement) => {
        const id = Date.now();
        let x = 0;
        let y = 0;

        if (e && 'clientX' in e) {
            const target = containerOverride || (e.currentTarget as HTMLElement);
            const rect = target.getBoundingClientRect();
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }

        setRipples(prev => [...prev, { id, x, y, size }]);
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== id));
        }, duration * 1000);
    }, [duration, size]);

    const render = (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 rounded-inherit">
            <AnimatePresence>
                {ripples.map(ripple => (
                    <motion.span
                        key={ripple.id}
                        initial={{ scale: 0, opacity: 0.8 }}
                        animate={{ scale: 15, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration, ease: [0.2, 0, 0, 1] }}
                        className="absolute rounded-full"
                        style={{
                            width: ripple.size,
                            height: ripple.size,
                            left: ripple.x - ripple.size / 2,
                            top: ripple.y - ripple.size / 2,
                            backgroundColor: color,
                        }}
                    />
                ))}
            </AnimatePresence>
        </div>
    );

    return { trigger, render };
}
