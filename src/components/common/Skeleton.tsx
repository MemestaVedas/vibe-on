import { HTMLMotionProps, motion } from 'motion/react';

interface SkeletonProps extends HTMLMotionProps<'div'> {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
}

export function Skeleton({
    className = '',
    variant = 'text',
    width,
    height,
    ...props
}: SkeletonProps) {
    const baseStyles = "bg-surface-container-highest/50 animate-pulse";

    const variantStyles = {
        text: "h-4 w-full rounded",
        circular: "rounded-full",
        rectangular: "rounded-none",
        rounded: "rounded-md",
    };

    const style = {
        width,
        height,
    };

    return (
        <motion.div
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
            style={style}
            {...props}
        />
    );
}

export function SkeletonAlbumGrid() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
            {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                    <Skeleton variant="rounded" className="aspect-square w-full" />
                    <Skeleton variant="text" width="80%" />
                    <Skeleton variant="text" width="50%" />
                </div>
            ))}
        </div>
    );
}

export function SkeletonTrackList() {
    return (
        <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-2">
                    <Skeleton variant="rounded" width={48} height={48} />
                    <div className="flex-1 flex flex-col gap-2">
                        <Skeleton variant="text" width="40%" />
                        <Skeleton variant="text" width="30%" />
                    </div>
                    <Skeleton variant="text" width="10%" />
                </div>
            ))}
        </div>
    );
}
