import React, { useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { motion, AnimatePresence } from 'framer-motion';

import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { downloadDir } from '@tauri-apps/api/path';

const BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const BAND_LABELS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

// Default preset IDs that cannot be deleted
const DEFAULT_PRESET_IDS = new Set([
    'flat', 'acoustic', 'classical', 'dance', 'deep', 'electronic',
    'hip-hop', 'jazz', 'latin', 'loudness', 'lounge', 'piano',
    'pop', 'r&b', 'rock', 'small-speakers', 'spoken-word',
    'increase-bass', 'reduce-bass', 'increase-treble', 'reduce-treble', 'increase-vocals'
]);

export const Equalizer: React.FC = () => {
    const {
        eqGains,
        setEqGain,
        presets,
        activePresetId,
        applyPreset,
        addPreset,
        removePreset,
        setShowEq,
        preampDb,
        setPreamp,
        balance,
        setBalance,
        speed,
        setSpeed
    } = usePlayerStore();

    const [newPresetName, setNewPresetName] = useState('');
    const [showPresetManager, setShowPresetManager] = useState(false);

    const handleGainChange = (index: number, value: number) => {
        console.log(`[EqualizerUI] Changing band ${index} to ${value} dB`);
        setEqGain(index, value);
    };

    console.log('[EqualizerUI] Render state:', { activePresetId, preampDb, eqGains });

    const handleExportPresets = async () => {
        try {
            const defaultPath = await downloadDir();
            const filePath = await save({
                defaultPath: `${defaultPath}/vibe_presets.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });

            if (filePath) {
                const customPresets = presets.filter(p => !DEFAULT_PRESET_IDS.has(p.id));
                await writeTextFile(filePath, JSON.stringify(customPresets, null, 2));
            }
        } catch (e) {
            console.error('Failed to export presets:', e);
        }
    };

    const handleImportPresets = async () => {
        try {
            const file = await open({
                multiple: false,
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });

            if (file && typeof file === 'string') {
                const content = await readTextFile(file);
                const imported = JSON.parse(content);
                if (Array.isArray(imported)) {
                    imported.forEach(p => {
                        if (p.name && Array.isArray(p.gains)) {
                            addPreset(p.name, p.gains);
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Failed to import presets:', e);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
            onClick={() => setShowEq(false)}
        >
            <motion.div
                layoutId="equalizer-panel"
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-5xl shadow-2xl relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 blur-[100px] pointer-events-none" />

                <div className="flex flex-col gap-8 relative z-10">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                                Audio Engine
                            </h2>
                            <p className="text-zinc-500 text-sm mt-1">10-Band Graphic EQ & DSP Effects</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowPresetManager(!showPresetManager)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg ${showPresetManager
                                    ? 'bg-zinc-200 text-zinc-900 shadow-zinc-200/20'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                    }`}
                            >
                                Presets
                            </button>
                            <button
                                onClick={() => setShowEq(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Main Equalizer Section */}
                        <div className="lg:col-span-3">
                            <div className="flex justify-between items-end h-64 gap-2 md:gap-4 px-2">
                                {eqGains.slice(0, 10).map((gain, i) => (
                                    <div key={BANDS[i]} className="flex-1 flex flex-col items-center gap-4 group h-full">
                                        <div className="relative w-full flex-1 flex flex-col items-center justify-center">
                                            {/* Track Background */}
                                            <div className="absolute inset-y-0 w-1 bg-zinc-800 rounded-full group-hover:bg-zinc-700 transition-colors" />

                                            {/* Active Indicator Line */}
                                            <div
                                                className="absolute w-1 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-300"
                                                style={{
                                                    height: `${Math.abs(gain) * 3}%`,
                                                    bottom: gain >= 0 ? '50%' : `calc(50% + ${gain * 3}%)`,
                                                    transformOrigin: gain >= 0 ? 'bottom' : 'top'
                                                }}
                                            />

                                            {/* Slider Input - Standard Rotation Strategy */}
                                            <input
                                                type="range"
                                                min="-15"
                                                max="15"
                                                step="0.1"
                                                value={gain}
                                                onChange={(e) => handleGainChange(i, parseFloat(e.target.value))}
                                                className="absolute cursor-pointer z-30 opacity-0 left-1/2 top-1/2"
                                                style={{
                                                    width: '256px', // Matches h-64
                                                    height: '80px', // Large hit area
                                                    transform: 'translate(-50%, -50%) rotate(-90deg)',
                                                    margin: 0,
                                                    padding: 0,
                                                    touchAction: 'none'
                                                }}
                                            />

                                            {/* Tooltip on Hover */}
                                            <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 bg-zinc-800 text-xs px-2 py-1 rounded-md text-zinc-300 shadow-xl border border-zinc-700 whitespace-nowrap z-30">
                                                Band {i}: {gain > 0 ? '+' : ''}{gain.toFixed(1)} dB
                                            </div>

                                            {/* Visual Knob */}
                                            <div
                                                className="pointer-events-none absolute w-6 h-6 bg-white rounded-lg shadow-xl border-4 border-zinc-900 z-10 flex items-center justify-center transition-all duration-75 group-active:scale-90"
                                                style={{
                                                    bottom: `calc(50% + ${gain * 3}% - 12px)`,
                                                    backgroundColor: gain !== 0 ? '#10b981' : '#fff'
                                                }}
                                            >
                                                <div className="w-1 h-2 bg-zinc-900/20 rounded-full" />
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter group-hover:text-emerald-500 transition-colors">
                                                {BAND_LABELS[i]}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8 pt-8 border-t border-zinc-800/50 flex items-center justify-center gap-12">
                                <div className="text-center">
                                    <span className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Status</span>
                                    <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                        {activePresetId ? presets.find(p => p.id === activePresetId)?.name : 'Custom'}
                                    </span>
                                </div>
                                <div className="w-px h-8 bg-zinc-800" />
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => applyPreset(presets.find(p => p.id === 'flat')!)}
                                        className="text-xs text-zinc-500 hover:text-white transition-colors uppercase tracking-widest font-bold"
                                    >
                                        Reset EQ
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* DSP & Effects Sidebar */}
                        <div className="flex flex-col gap-6">
                            <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-4">Gain Control</span>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <input
                                            type="range"
                                            min="-12"
                                            max="12"
                                            step="0.5"
                                            value={preampDb}
                                            onChange={(e) => setPreamp(parseFloat(e.target.value))}
                                            className="w-full accent-emerald-500"
                                        />
                                    </div>
                                    <span className="text-sm font-mono text-zinc-300 w-16 text-right">
                                        {preampDb > 0 ? '+' : ''}{preampDb.toFixed(1)} <span className="text-[10px] text-zinc-500">dB</span>
                                    </span>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <span className="text-[10px] text-zinc-600">PREAMP</span>
                                    <button onClick={() => setPreamp(0)} className="text-[10px] text-zinc-600 hover:text-zinc-400">RESET</button>
                                </div>
                            </div>

                            <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-4">Stereo Balance</span>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <input
                                            type="range"
                                            min="-1"
                                            max="1"
                                            step="0.01"
                                            value={balance}
                                            onChange={(e) => setBalance(parseFloat(e.target.value))}
                                            className="w-full accent-blue-500"
                                        />
                                    </div>
                                    <span className="text-sm font-mono text-zinc-300 w-12 text-right">
                                        {balance === 0 ? 'C' : balance < 0 ? 'L' : 'R'}
                                    </span>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <span className="text-[10px] text-zinc-600">PAN</span>
                                    <button onClick={() => setBalance(0)} className="text-[10px] text-zinc-600 hover:text-zinc-400">CENTER</button>
                                </div>
                            </div>

                            <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-4">Playback Speed</span>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="2.0"
                                            step="0.05"
                                            value={speed}
                                            onChange={(e) => setSpeed(parseFloat(e.target.value))}
                                            className="w-full accent-purple-500"
                                        />
                                    </div>
                                    <span className="text-sm font-mono text-zinc-300 w-12 text-right">
                                        {speed.toFixed(2)}<span className="text-[10px] text-zinc-500">x</span>
                                    </span>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <span className="text-[10px] text-zinc-600">TEMPO</span>
                                    <button onClick={() => setSpeed(1.0)} className="text-[10px] text-zinc-600 hover:text-zinc-400">1.0x</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preset Manager Drawer */}
                    <AnimatePresence>
                        {showPresetManager && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden border-t border-zinc-800 mt-4 pt-6"
                            >
                                <div className="flex flex-col gap-6">
                                    <div className="flex flex-wrap gap-2">
                                        {presets.map((preset) => (
                                            <div key={preset.id} className="relative group">
                                                <button
                                                    onClick={() => applyPreset(preset)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${activePresetId === preset.id
                                                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                                                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                                        }`}
                                                >
                                                    {preset.name}
                                                </button>
                                                {!DEFAULT_PRESET_IDS.has(preset.id) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removePreset(preset.id); }}
                                                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-4 items-end">
                                        <div className="flex-1 w-full">
                                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Preset Name</label>
                                            <input
                                                type="text"
                                                placeholder="My Awesome Preset..."
                                                value={newPresetName}
                                                onChange={(e) => setNewPresetName(e.target.value)}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
                                            />
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <button
                                                onClick={() => {
                                                    if (newPresetName.trim()) {
                                                        addPreset(newPresetName, [...eqGains]);
                                                        setNewPresetName('');
                                                    }
                                                }}
                                                className="flex-1 md:flex-none px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                            >
                                                Save Preset
                                            </button>
                                            <button
                                                onClick={handleExportPresets}
                                                className="p-2.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-colors border border-zinc-700/50"
                                                title="Export Custom Presets"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={handleImportPresets}
                                                className="p-2.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-colors border border-zinc-700/50"
                                                title="Import Presets"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
};
