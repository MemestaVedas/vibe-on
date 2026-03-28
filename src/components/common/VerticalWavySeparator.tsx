import { useMemo } from 'react';

interface VerticalWavySeparatorProps {
    color?: string; // CSS color string
}

export function VerticalWavySeparator({ color = "var(--md-sys-color-outline)" }: VerticalWavySeparatorProps) {
    return (
        <div className="h-full w-3 flex flex-col items-center shrink-0">
            <VerticalWavePattern color={color} />
        </div>
    );
}

function VerticalWavePattern({ color }: { color: string }) {
    const patternId = useMemo(() => `vertical-wave-pattern-${Math.random().toString(36).substr(2, 9)}`, []);

    return (
        <svg width="100%" height="100%" preserveAspectRatio="none">
            <defs>
                <pattern id={patternId} x="0" y="0" width="12" height="40" patternUnits="userSpaceOnUse">
                    {/* Vertical Sine wave: Start mid (6), go left, then right. Height 40. */}
                    {/* M 6 0 Q 1 10 6 20 T 6 40 */}
                    <path
                        d="M 6 0 Q 1 10 6 20 T 6 40"
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </pattern>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
    );
}
