import { useState, useEffect, useRef } from 'react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { motion, AnimatePresence } from 'motion/react';
import { useMobileStore } from '../store/mobileStore';
import { useThemeStore } from '../store/themeStore';
import { IconClose, IconRefresh, IconWifi, IconCheck, IconMobileDevice } from './Icons';

interface MobilePairingPopupProps {
    anchorRef: React.RefObject<HTMLButtonElement>;
}


export function MobilePairingPopup({ anchorRef }: MobilePairingPopupProps) {
    const {
        status,
        serverRunning,
        serverPort,
        localIP,
        discoveredDevices,
        connectedDevice,
        lastConnectedDevice,
        error,
        popupOpen,
        setPopupOpen,
        startServer,
        stopServer,
        disconnect,
        connectToDevice,
        startDiscoveryPolling,
        stopDiscoveryPolling,
    } = useMobileStore();

    const { colors } = useThemeStore();
    const popupRef = useRef<HTMLDivElement>(null);
    const [showCopyFeedback, setShowCopyFeedback] = useState(false);
    const [position, setPosition] = useState({ top: 0, right: 0 });

    // Calculate popup position based on anchor
    useEffect(() => {
        if (anchorRef.current && popupOpen) {
            const rect = anchorRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            });
        }
    }, [anchorRef, popupOpen]);

    // Start/stop discovery polling when popup opens/closes
    useEffect(() => {
        if (popupOpen && serverRunning) {
            startDiscoveryPolling();
        } else {
            stopDiscoveryPolling();
        }

        return () => stopDiscoveryPolling();
    }, [popupOpen, serverRunning, startDiscoveryPolling, stopDiscoveryPolling]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                popupRef.current &&
                !popupRef.current.contains(e.target as Node) &&
                anchorRef.current &&
                !anchorRef.current.contains(e.target as Node)
            ) {
                setPopupOpen(false);
            }
        };

        if (popupOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [popupOpen, setPopupOpen, anchorRef]);

    // Auto-start server when popup opens
    useEffect(() => {
        if (popupOpen && !serverRunning) {
            startServer();
        }
    }, [popupOpen, serverRunning, startServer]);


    const getStatusText = () => {
        switch (status) {
            case 'disconnected': return 'Server Offline';
            case 'searching': return 'Broadcasting Signal';
            case 'connecting': return 'Linking...';
            case 'connected': return `Linked to ${connectedDevice?.name || 'Device'}`;
        }
    };

    const getStatusColor = () => {
        switch (status) {
            case 'disconnected': return colors.outline;
            case 'searching': return colors.tertiary;
            case 'connecting': return colors.secondary;
            case 'connected': return colors.primary;
        }
    };

    return (
        <AnimatePresence>
            {popupOpen && (
                <motion.div
                    ref={popupRef}
                    className="fixed z-[9999] w-80 overflow-hidden"
                    style={{
                        top: position.top,
                        right: position.right,
                        backgroundColor: colors.surfaceContainerHigh,
                        borderRadius: '24px',
                        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${colors.outlineVariant}30`,
                    }}
                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    onClick={(e) => e.stopPropagation()}
                >

                    {/* Content */}
                    <div className="relative z-10 p-5">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <IconMobileDevice size={20} style={{ color: colors.primary }} />
                                <span
                                    className="font-semibold text-base"
                                    style={{ color: colors.onSurface }}
                                >
                                    Mobile Companion
                                </span>
                            </div>
                            <button
                                onClick={() => setPopupOpen(false)}
                                className="p-1 rounded-full transition-colors hover:bg-white/10"
                            >
                                <IconClose size={18} style={{ color: colors.onSurfaceVariant }} />
                            </button>
                        </div>

                        {/* Status Indicator - Hidden when connected to reduce redundancy */}
                        <AnimatePresence mode="wait">
                            {status !== 'connected' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-2 mb-4 px-3 py-2 rounded-full overflow-hidden"
                                    style={{ backgroundColor: `${getStatusColor()}20` }}
                                >
                                    <div
                                        className={`w-2 h-2 rounded-full ${status === 'searching' || status === 'connecting' ? 'animate-pulse' : ''}`}
                                        style={{ backgroundColor: getStatusColor() }}
                                    />
                                    <span
                                        className="text-sm font-medium"
                                        style={{ color: getStatusColor() }}
                                    >
                                        {getStatusText()}
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Error Message */}
                        {error && (
                            <div
                                className="mb-4 px-3 py-2 rounded-xl text-sm"
                                style={{ backgroundColor: '#ef444420', color: '#ef4444' }}
                            >
                                {error}
                            </div>
                        )}

                        {/* State-Aware Content Section */}
                        <AnimatePresence mode="wait">
                            {status === 'connected' ? (
                                /* --- CONNECTED STATE VIEW --- */
                                <motion.div
                                    key="connected-view"
                                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                    className="mb-6 p-6 rounded-3xl flex flex-col items-center gap-4 relative overflow-hidden"
                                    style={{
                                        backgroundColor: colors.surfaceContainer,
                                        border: `1px solid ${colors.primary}30`
                                    }}
                                >
                                    {/* Heartbeat Background Glow */}
                                    <motion.div
                                        className="absolute inset-0 z-0 opacity-20"
                                        animate={{
                                            background: [
                                                `radial-gradient(circle at center, ${colors.primary}20 0%, transparent 70%)`,
                                                `radial-gradient(circle at center, ${colors.primary}40 0%, transparent 70%)`,
                                                `radial-gradient(circle at center, ${colors.primary}20 0%, transparent 70%)`
                                            ]
                                        }}
                                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                    />

                                    <div className="relative z-10 flex flex-col items-center gap-3">
                                        <div
                                            className="w-16 h-16 rounded-2xl flex items-center justify-center relative shadow-lg"
                                            style={{ backgroundColor: colors.primaryContainer }}
                                        >
                                            <IconMobileDevice size={40} style={{ color: colors.onPrimaryContainer }} />
                                            {/* Small live pulsating indicator */}
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                                            </div>
                                        </div>

                                        <div className="text-center">
                                            <h3 className="text-lg font-bold" style={{ color: colors.onSurface }}>
                                                {connectedDevice?.name || 'VIBE-ON Mobile'}
                                            </h3>
                                            <p className="text-xs font-medium opacity-60" style={{ color: colors.onSurfaceVariant }}>
                                                {connectedDevice?.platform || 'Active Connection'} • {localIP}
                                            </p>
                                        </div>

                                        <div
                                            className="px-4 py-1.5 rounded-full flex items-center gap-2 border shadow-sm"
                                            style={{
                                                backgroundColor: `${colors.primary}10`,
                                                borderColor: `${colors.primary}20`,
                                                color: colors.primary
                                            }}
                                        >
                                            <IconCheck size={14} />
                                            <span className="text-[11px] font-bold uppercase tracking-wider">Securely Linked</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                /* --- BROADCASTING STATE VIEW --- */
                                <motion.div
                                    key="broadcasting-view"
                                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                    className="mb-6"
                                >
                                    {serverRunning && localIP && (
                                        <div
                                            className="p-6 rounded-3xl flex flex-col items-center gap-4 cursor-pointer group transition-all hover:translate-y-[-2px] hover:shadow-lg active:scale-[0.98] relative overflow-hidden"
                                            style={{
                                                backgroundColor: colors.surfaceContainer,
                                                border: `1px solid ${colors.outlineVariant}20`
                                            }}
                                            onClick={async () => {
                                                try {
                                                    await writeText(`${localIP}:${serverPort}`);
                                                    setShowCopyFeedback(true);
                                                    setTimeout(() => setShowCopyFeedback(false), 2000);
                                                } catch (e) {
                                                    console.error('Failed to copy IP:', e);
                                                }
                                            }}
                                            title="Click to copy address"
                                        >
                                            <AnimatePresence>
                                                {showCopyFeedback && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        className="absolute inset-0 z-20 flex items-center justify-center"
                                                        style={{ backgroundColor: `${colors.primary}90` }}
                                                    >
                                                        <div className="flex flex-col items-center gap-1 text-white">
                                                            <IconCheck size={24} />
                                                            <span className="text-xs font-bold uppercase tracking-widest">Address Copied</span>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-opacity-20"
                                                style={{ backgroundColor: `${colors.primary}20` }}>
                                                <IconWifi size={14} className="animate-pulse" style={{ color: colors.primary }} />
                                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.primary }}>
                                                    Broadcasting on
                                                </span>
                                            </div>

                                            <div className="text-center">
                                                <h2
                                                    className="text-3xl font-bold font-mono tracking-tight group-hover:scale-105 transition-transform"
                                                    style={{ color: colors.primary }}
                                                >
                                                    {localIP}
                                                </h2>
                                                <div className="flex items-center justify-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest" style={{ color: colors.onSurfaceVariant }}>Port</span>
                                                    <code className="text-sm font-bold" style={{ color: colors.secondary }}>{serverPort}</code>
                                                </div>
                                            </div>

                                            <div className="mt-1 flex flex-col items-center gap-2">
                                                <p
                                                    className="text-[11px] text-center font-medium opacity-60"
                                                    style={{ color: colors.onSurfaceVariant }}
                                                >
                                                    Enter this address in the VIBE-ON! mobile app
                                                </p>
                                                <div className="text-[10px] font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: colors.primary }}>
                                                    Click to Copy Address
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Discovered Mobile Devices */}
                        {serverRunning && discoveredDevices.length > 0 && (
                            <div
                                className="mb-4 p-3 rounded-xl"
                                style={{ backgroundColor: colors.surfaceContainer }}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <IconMobileDevice size={16} style={{ color: colors.tertiary }} />
                                    <span
                                        className="text-sm font-medium"
                                        style={{ color: colors.onSurface }}
                                    >
                                        Discovered Devices ({discoveredDevices.length})
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {discoveredDevices.map((device) => (
                                        <motion.div
                                            key={device.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:opacity-80"
                                            style={{ backgroundColor: colors.surfaceContainerHighest }}
                                            onClick={() => connectToDevice(device)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center"
                                                    style={{ backgroundColor: `${colors.tertiary}30` }}
                                                >
                                                    <IconMobileDevice size={16} style={{ color: colors.tertiary }} />
                                                </div>
                                                <div>
                                                    <p
                                                        className="text-sm font-medium"
                                                        style={{ color: colors.onSurface }}
                                                    >
                                                        {device.name}
                                                    </p>
                                                    <p
                                                        className="text-xs"
                                                        style={{ color: colors.onSurfaceVariant }}
                                                    >
                                                        {device.ip} • {device.platform}
                                                    </p>
                                                </div>
                                            </div>
                                            <div
                                                className="px-2 py-1 rounded-full text-xs font-medium"
                                                style={{
                                                    backgroundColor: `${colors.primary}20`,
                                                    color: colors.primary,
                                                }}
                                            >
                                                Connect
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Scanning indicator when no devices found */}
                        {serverRunning && discoveredDevices.length === 0 && status === 'searching' && (
                            <div
                                className="mb-4 p-3 rounded-xl"
                                style={{ backgroundColor: colors.surfaceContainer }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                                        style={{ borderColor: `${colors.tertiary}40`, borderTopColor: 'transparent' }}
                                    />
                                    <span
                                        className="text-sm"
                                        style={{ color: colors.onSurfaceVariant }}
                                    >
                                        Scanning for mobile devices...
                                    </span>
                                </div>
                            </div>
                        )}


                        {/* Last Connected Device */}
                        {lastConnectedDevice && status !== 'connected' && (
                            <div
                                className="mb-4 p-3 rounded-xl cursor-pointer transition-colors hover:opacity-80"
                                style={{ backgroundColor: colors.surfaceContainer }}
                                onClick={() => {
                                    // Reconnect to last device
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p
                                            className="text-sm font-medium"
                                            style={{ color: colors.onSurface }}
                                        >
                                            {lastConnectedDevice.name}
                                        </p>
                                        <p
                                            className="text-xs"
                                            style={{ color: colors.onSurfaceVariant }}
                                        >
                                            Last connected
                                        </p>
                                    </div>
                                    <IconRefresh size={18} style={{ color: colors.primary }} />
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            {!serverRunning ? (
                                <button
                                    onClick={startServer}
                                    className="flex-1 py-2.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
                                    style={{
                                        backgroundColor: colors.primary,
                                        color: colors.onPrimary,
                                    }}
                                >
                                    Start Server
                                </button>
                            ) : status === 'connected' ? (
                                <button
                                    onClick={disconnect}
                                    className="flex-1 py-2.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
                                    style={{
                                        backgroundColor: colors.secondaryContainer,
                                        color: colors.onSecondaryContainer,
                                    }}
                                >
                                    Disconnect
                                </button>
                            ) : (
                                <button
                                    onClick={stopServer}
                                    className="flex-1 py-2.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
                                    style={{
                                        backgroundColor: colors.surfaceContainerHighest,
                                        color: colors.onSurface,
                                    }}
                                >
                                    Stop Server
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
