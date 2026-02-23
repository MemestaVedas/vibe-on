import React, { useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useThemeStore } from '../store/themeStore';
import { motion, AnimatePresence } from 'motion/react';

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

    const { colors } = useThemeStore();
    const { primary, surface } = colors;

    const [newPresetName, setNewPresetName] = useState('');
    const [showPresetManager, setShowPresetManager] = useState(false);

    const handleGainChange = (index: number, value: number) => {
        setEqGain(index, value);
    };

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowEq(false)}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                layoutId="equalizer-panel"
                className="bg-surface border border-white/5 rounded-[2rem] p-8 w-full max-w-5xl shadow-2xl relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                style={{ backgroundColor: surface }}
            >
                {/* Decorative Background */}
                <div
                    className="absolute top-0 right-0 w-96 h-96 opacity-10 blur-[120px] pointer-events-none rounded-full"
                    style={{ backgroundColor: primary }}
                />

                <div className="flex flex-col gap-8 relative z-10">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-on-surface">
                                Audio Engine
                            </h2>
                            <p className="text-on-surface-variant text-sm mt-1">10-Band Graphic EQ & DSP Effects</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowPresetManager(!showPresetManager)}
                                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${showPresetManager
                                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                                    : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface'
                                    }`}
                                style={showPresetManager ? { backgroundColor: primary } : {}}
                            >
                                Presets
                            </button>
                            <button
                                onClick={() => setShowEq(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Main Equalizer Section */}
                        <div className="lg:col-span-3 bg-surface-container rounded-[1.5rem] p-6 border border-white/5">
                            <div className="flex justify-between items-end h-64 gap-2 md:gap-4 px-2">
                                {eqGains.slice(0, 10).map((gain, i) => (
                                    <div key={BANDS[i]} className="flex-1 flex flex-col items-center gap-4 group h-full">
                                        <div className="relative w-full flex-1 flex flex-col items-center justify-center">
                                            {/* Track Background */}
                                            <div className="absolute inset-y-0 w-1.5 bg-surface-container-highest rounded-full group-hover:bg-on-surface-variant/20 transition-colors" />

                                            {/* Active Indicator Line */}
                                            <div
                                                className="absolute w-1.5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.2)] transition-all duration-300"
                                                style={{
                                                    backgroundColor: primary,
                                                    height: `${Math.abs(gain) * 3}%`,
                                                    bottom: gain >= 0 ? '50%' : `calc(50% + ${gain * 3}%)`,
                                                    transformOrigin: gain >= 0 ? 'bottom' : 'top',
                                                    boxShadow: `0 0 10px ${primary}40`
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
                                            <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 bg-surface-container-highest text-xs px-3 py-1.5 rounded-lg text-on-surface shadow-xl border border-white/5 whitespace-nowrap z-50 pointer-events-none font-medium">
                                                {gain > 0 ? '+' : ''}{gain.toFixed(1)} dB
                                            </div>

                                            {/* Visual Knob */}
                                            <div
                                                className="pointer-events-none absolute w-5 h-5 rounded-full shadow-lg border-[3px] z-10 flex items-center justify-center transition-all duration-200 group-active:scale-95"
                                                style={{
                                                    bottom: `calc(50% + ${gain * 3}% - 10px)`,
                                                    backgroundColor: surface,
                                                    borderColor: primary
                                                }}
                                            />
                                        </div>

                                        <div className="flex flex-col items-center gap-1">
                                            <span
                                                className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-200"
                                                style={{ color: gain !== 0 ? primary : colors.onSurfaceVariant }}
                                            >
                                                {BAND_LABELS[i]}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-center gap-12">
                                <div className="text-center">
                                    <span className="block text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-widest mb-1.5">Preset</span>
                                    <span
                                        className="text-xs font-semibold px-4 py-1.5 rounded-full border bg-primary/10 border-primary/20"
                                        style={{ color: primary }}
                                    >
                                        {activePresetId ? presets.find(p => p.id === activePresetId)?.name : 'Custom'}
                                    </span>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => applyPreset(presets.find(p => p.id === 'flat')!)}
                                        className="text-xs text-on-surface-variant hover:text-on-surface transition-colors uppercase tracking-widest font-bold px-4 py-2 hover:bg-white/5 rounded-full"
                                    >
                                        Reset EQ
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* DSP & Effects Sidebar */}
                        <div className="flex flex-col gap-6">
                            {[
                                { label: 'Preamp', value: preampDb, setter: setPreamp, min: -12, max: 12, step: 0.5, format: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`, resetVal: 0 },
                                { label: 'Balance', value: balance, setter: setBalance, min: -1, max: 1, step: 0.01, format: (v: number) => v === 0 ? 'C' : v < 0 ? 'L' : 'R', resetVal: 0 },
                                { label: 'Tempo', value: speed, setter: setSpeed, min: 0.5, max: 2.0, step: 0.05, format: (v: number) => `${v.toFixed(2)}x`, resetVal: 1.0 }
                            ].map((control) => (
                                <div key={control.label} className="bg-surface-container rounded-[1.25rem] p-5 border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{control.label}</span>
                                        <button
                                            onClick={() => control.setter(control.resetVal)}
                                            className="text-[10px] font-bold text-primary hover:text-primary/80 uppercase tracking-wider"
                                            style={{ color: primary }}
                                        >
                                            Reset
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 relative h-6 flex items-center">
                                            <input
                                                type="range"
                                                min={control.min}
                                                max={control.max}
                                                step={control.step}
                                                value={control.value}
                                                onChange={(e) => control.setter(parseFloat(e.target.value))}
                                                className="w-full absolute z-10 opacity-0 cursor-pointer h-full"
                                            />
                                            {/* Custom Track */}
                                            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${((control.value - control.min) / (control.max - control.min)) * 100}%`,
                                                        backgroundColor: primary
                                                    }}
                                                />
                                            </div>
                                            {/* Custom Thumb */}
                                            <div
                                                className="absolute w-4 h-4 bg-surface border-2 rounded-full shadow-sm pointer-events-none"
                                                style={{
                                                    left: `calc(${((control.value - control.min) / (control.max - control.min)) * 100}% - 8px)`,
                                                    borderColor: primary
                                                }}
                                            />
                                        </div>
                                        <span className="text-sm font-mono text-on-surface w-14 text-right font-medium">
                                            {control.format(control.value)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Preset Manager Drawer */}
                    <AnimatePresence>
                        {showPresetManager && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden border-t border-white/5 mt-2 pt-6"
                            >
                                <div className="flex flex-col gap-6">
                                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto no-scrollbar pr-2">
                                        {presets.map((preset) => (
                                            <div key={preset.id} className="relative group">
                                                <button
                                                    onClick={() => applyPreset(preset)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${activePresetId === preset.id
                                                        ? 'border-transparent text-on-primary shadow-md'
                                                        : 'bg-surface-container-high border-transparent text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                                                        }`}
                                                    style={activePresetId === preset.id ? { backgroundColor: primary, color: colors.onPrimary } : {}}
                                                >
                                                    {preset.name}
                                                </button>
                                                {!DEFAULT_PRESET_IDS.has(preset.id) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removePreset(preset.id); }}
                                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-on-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm scale-90 hover:scale-100"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-4 items-end bg-surface-container p-4 rounded-xl border border-white/5">
                                        <div className="flex-1 w-full">
                                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1.5">Save New Preset</label>
                                            <input
                                                type="text"
                                                placeholder="My Awesome Preset..."
                                                value={newPresetName}
                                                onChange={(e) => setNewPresetName(e.target.value)}
                                                className="w-full bg-surface-container-high border-transparent rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-on-surface-variant/50"
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
                                                className="flex-1 md:flex-none px-6 py-2.5 text-on-primary text-sm font-bold rounded-lg transition-all shadow-lg active:scale-95"
                                                style={{ backgroundColor: primary }}
                                            >
                                                Save
                                            </button>
                                            <div className="w-px h-10 bg-white/10 mx-2 hidden md:block" />
                                            <button
                                                onClick={handleExportPresets}
                                                className="p-2.5 bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors"
                                                title="Export Custom Presets"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={handleImportPresets}
                                                className="p-2.5 bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors"
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
