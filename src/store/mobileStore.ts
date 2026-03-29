import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
type DiscoveryIntervalHandle = ReturnType<typeof setInterval>;
type DiscoveryWindow = Window & { __mobileDiscoveryInterval?: DiscoveryIntervalHandle };

export type MobileConnectionStatus = 'disconnected' | 'searching' | 'connecting' | 'connected';

export interface DiscoveredDevice {
    id: string;
    name: string;
    ip: string;
    port: number;
    platform: string;
}

export interface ConnectedDevice {
    id: string;
    name: string;
    ip: string;
    port: number;
    platform: string;
    connectedAt: number;
    protocolVersion?: string;
    negotiatedCapabilities?: string[];
}

interface MobileStore {
    // State
    status: MobileConnectionStatus;
    serverRunning: boolean;
    serverPort: number;
    localIP: string | null;
    discoveredDevices: DiscoveredDevice[];
    connectedDevice: ConnectedDevice | null;
    lastConnectedDevice: ConnectedDevice | null;
    error: string | null;

    // UI State
    popupOpen: boolean;

    // Actions
    setPopupOpen: (open: boolean) => void;
    togglePopup: () => void;

    // Server Actions
    startServer: () => Promise<void>;
    stopServer: () => Promise<void>;
    checkServerStatus: () => Promise<void>;

    // Connection Actions
    setStatus: (status: MobileConnectionStatus) => void;
    addDiscoveredDevice: (device: DiscoveredDevice) => void;
    removeDiscoveredDevice: (id: string) => void;
    clearDiscoveredDevices: () => void;
    connectToDevice: (device: DiscoveredDevice) => Promise<void>;
    setConnectedDevice: (device: ConnectedDevice) => void;
    disconnect: () => void;
    setError: (error: string | null) => void;

    // Network & Discovery
    fetchLocalIP: () => Promise<void>;
    scanForDevices: () => Promise<void>;
    startDiscoveryPolling: () => void;
    stopDiscoveryPolling: () => void;
    setupListeners: () => Promise<void>;
}

export const useMobileStore = create<MobileStore>()(
    persist(
        (set, get) => ({
            // Initial State
            status: 'disconnected',
            serverRunning: false,
            serverPort: 5000,
            localIP: null,
            discoveredDevices: [],
            connectedDevice: null,
            lastConnectedDevice: null,
            error: null,
            popupOpen: false,

            // UI Actions
            setPopupOpen: (open) => set({ popupOpen: open }),
            togglePopup: () => set((state) => ({ popupOpen: !state.popupOpen })),

            // Server Actions
            startServer: async () => {
                try {
                    set({ error: null, status: 'searching' });
                    // Ensure listeners are active
                    get().setupListeners();
                    await invoke('start_mobile_server');
                    set({ serverRunning: true });
                    // Wait a bit for server to fully start, then fetch info
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await get().fetchLocalIP();
                } catch (e) {
                    set({ error: String(e), status: 'disconnected' });
                }
            },

            stopServer: async () => {
                try {
                    await invoke('stop_mobile_server');
                    set({
                        serverRunning: false,
                        status: 'disconnected',
                        connectedDevice: null,
                    });
                } catch (e) {
                    set({ error: String(e) });
                }
            },

            checkServerStatus: async () => {
                try {
                    const running = await invoke<boolean>('get_server_status');
                    set({ serverRunning: running });
                    if (running && get().status === 'disconnected') {
                        set({ status: 'searching' });
                        await get().fetchLocalIP();
                    }
                } catch (e) {
                    console.error('Failed to check server status:', e);
                }
            },

            // Connection Actions
            setStatus: (status) => set({ status }),

            addDiscoveredDevice: (device) => set((state) => ({
                discoveredDevices: state.discoveredDevices.some(d => d.id === device.id)
                    ? state.discoveredDevices
                    : [...state.discoveredDevices, device],
            })),

            removeDiscoveredDevice: (id) => set((state) => ({
                discoveredDevices: state.discoveredDevices.filter(d => d.id !== id),
            })),

            clearDiscoveredDevices: () => set({ discoveredDevices: [] }),

            connectToDevice: async (device) => {
                set({ status: 'connecting', error: null });
                try {
                    // In future: establish actual connection
                    // For now, just mark as connected
                    const connectedDevice: ConnectedDevice = {
                        ...device,
                        connectedAt: Date.now(),
                    };
                    set({
                        status: 'connected',
                        connectedDevice,
                        lastConnectedDevice: connectedDevice,
                    });
                } catch (e) {
                    set({ status: 'searching', error: String(e) });
                }
            },

            setConnectedDevice: (device) => {
                set({
                    status: 'connected',
                    connectedDevice: device,
                    lastConnectedDevice: device,
                });
            },

            disconnect: () => {
                set({
                    status: get().serverRunning ? 'searching' : 'disconnected',
                    connectedDevice: null,
                });
            },

            setError: (error) => set({ error }),

            // Network & Discovery
            fetchLocalIP: async () => {
                try {
                    // 1. Try to get local IP directly from Rust backend (most reliable)
                    const rustIp = await invoke<string | null>('get_local_ip').catch(() => null);
                    if (rustIp) {
                        console.log('[Mobile] Got local IP from Rust:', rustIp);
                        set({ localIP: rustIp });
                        return;
                    }

                    // 2. Fallback: Fetch server info from the running API
                    const port = get().serverPort;
                    const response = await fetch(`http://localhost:${port}/api/info`).catch(() => null);
                    if (response?.ok) {
                        const data = await response.json();
                        console.log('[Mobile] Server info:', data);
                        if (data.localIp) {
                            set({ localIP: data.localIp, serverPort: data.port || port });
                            return;
                        }
                    }
                    set({
                        localIP: null,
                        error: 'Could not determine LAN IP. Check network adapter and firewall settings.',
                    });
                } catch (e) {
                    console.error('Failed to fetch local IP:', e);
                    set({
                        localIP: null,
                        error: 'Failed to determine LAN IP. Check network adapter and firewall settings.',
                    });
                }
            },

            scanForDevices: async () => {
                // Connected devices are tracked via Tauri events
                // (mobile_client_connected / mobile_client_disconnected)
                // handled in GlobalEffects.tsx — nothing to poll here.
                console.log('[Mobile] Connected devices are tracked via Tauri events');
            },

            startDiscoveryPolling: () => {
                // Poll for devices every 3 seconds
                const poll = async () => {
                    if (get().serverRunning && get().popupOpen) {
                        await get().scanForDevices();
                    }
                };

                // Initial scan
                poll();

                // Set up interval (stored in window for cleanup)
                const intervalId = setInterval(poll, 3000);
                (window as DiscoveryWindow).__mobileDiscoveryInterval = intervalId;
            },

            stopDiscoveryPolling: () => {
                const intervalId = (window as DiscoveryWindow).__mobileDiscoveryInterval;
                if (intervalId) {
                    clearInterval(intervalId);
                    (window as DiscoveryWindow).__mobileDiscoveryInterval = undefined;
                }
            },

            setupListeners: async () => {
                // Note: Listeners are already set up in App.tsx
                // This function is kept for backwards compatibility but does nothing
                // The actual listeners are set up globally in App.tsx via useEffect
                console.log('[Mobile] Listeners already set up in App.tsx');
            },
        }),
        {
            name: 'vibe-mobile',
            partialize: (state) => ({
                lastConnectedDevice: state.lastConnectedDevice,
                serverPort: state.serverPort,
            }),
        }
    )
);
