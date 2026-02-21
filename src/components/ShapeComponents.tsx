import { useMemo } from 'react';

// M3 Circle Shape for Songs
export const M3CircleImage = ({ src, fallback }: { src: string | null, fallback: React.ReactNode }) => {
    if (src) {
        return (
            <div className="w-full h-full overflow-hidden rounded-full bg-surface-container-highest">
                <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="w-full h-full object-cover"
                />
            </div>
        );
    }

    const uniqueId = useMemo(() => `circle-${Math.random().toString(36).substr(2, 9)}`, []);

    return (
        <svg viewBox="0 0 320 320" className="w-full h-full">
            <defs>
                <clipPath id={uniqueId}>
                    <circle cx="160" cy="160" r="160" />
                </clipPath>
            </defs>
            <g clipPath={`url(#${uniqueId})`}>
                <rect x="0" y="0" width="320" height="320" fill="var(--md-sys-color-surface-container-highest)" />
                <g transform="translate(160, 160)">
                    {fallback}
                </g>
            </g>
        </svg>
    );
};

// M3 Stadium/Pill Shape for Playlists
export const M3StadiumImage = ({ src, fallback }: { src: string | null, fallback: React.ReactNode }) => {
    if (src) {
        return (
            <div className="w-full h-full overflow-hidden bg-surface-container-highest" style={{ borderRadius: '50px' }}>
                <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="w-full h-full object-cover"
                />
            </div>
        );
    }

    const uniqueId = useMemo(() => `stadium-${Math.random().toString(36).substr(2, 9)}`, []);

    return (
        <svg viewBox="0 0 310 320" className="w-full h-full">
            <defs>
                <clipPath id={uniqueId}>
                    <path d="M0 81.36C0 36.42 36.42 0 81.36 0H228.64C273.58 0 310 36.42 310 81.36C310 118.41 285.23 149.68 251.34 159.5C251.12 159.57 250.97 159.77 250.97 160C250.97 160.23 251.12 160.43 251.34 160.5C285.23 170.32 310 201.59 310 238.64C310 283.58 273.58 320 228.64 320H81.36C36.42 320 0 283.58 0 238.64C0 201.83 24.45 170.73 58 160.69C58.3 160.6 58.51 160.32 58.51 160C58.51 159.68 58.3 159.4 58 159.31C24.45 149.27 0 118.17 0 81.36Z" />
                </clipPath>
            </defs>
            <g clipPath={`url(#${uniqueId})`}>
                <rect x="0" y="0" width="310" height="320" fill="var(--md-sys-color-surface-container-highest)" />
                <g transform="translate(155, 160)">
                    {fallback}
                </g>
            </g>
        </svg>
    );
};
