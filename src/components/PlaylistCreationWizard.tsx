import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  IconMusicNote as music,
  IconHeart as heart,
  IconSettings as palette,
  IconSearch as search,
  IconClose as x,
  IconCheck as check,
  IconNext as chevronRight,
  IconAlbum as imageIcon,
  IconDownload as upload,
} from './Icons';
import { TrackInfo } from '../types';

export type PlaylistCustomizationType = 'default' | 'image' | 'icon';

export interface PlaylistCustomization {
  type: PlaylistCustomizationType;
  color?: string;
  imageUri?: string;
  iconName?: string;
}

interface PlaylistCreationWizardProps {
  isOpen: boolean;
  allSongs: TrackInfo[];
  onCreatePlaylist: (name: string, songPaths: string[], customization: PlaylistCustomization) => Promise<void>;
  onClose: () => void;
}

const PLAYLIST_COLORS = [
  '#E8B4F5', '#B39DDB', '#9FA8DA', '#90CAF9',
  '#81D4FA', '#80DEEA', '#80CBC4', '#A5D6A7',
  '#C8E6C9', '#DCEDC8', '#FFF9C4', '#FFE0B2',
  '#FFCC80', '#FFAB91', '#EF9A9A', '#F8BBD0',
  '#C62828', '#1B5E20', '#0D47A1', '#F57F17'
];

const PLAYLIST_ICONS = [
  { name: 'MusicNote', icon: music },
  { name: 'Heart', icon: heart },
  { name: 'Palette', icon: palette },
  // Add more icons as needed
];

export function PlaylistCreationWizard({ isOpen, allSongs, onCreatePlaylist, onClose }: PlaylistCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [playlistName, setPlaylistName] = useState('');
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [customization, setCustomization] = useState<PlaylistCustomization>({ type: 'default' });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSongs = allSongs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
        setCustomization(prev => ({
          ...prev,
          type: 'image',
          imageUri: e.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorSelect = (color: string) => {
    setCustomization(prev => ({
      ...prev,
      color,
      type: prev.type === 'default' ? 'default' : prev.type
    }));
  };

  const handleIconSelect = (iconName: string) => {
    setCustomization(prev => ({
      ...prev,
      type: 'icon',
      iconName
    }));
  };

  const toggleSongSelection = (path: string) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedSongs(newSelected);
  };

  const handleSubmit = async () => {
    if (currentStep === 0) {
      if (playlistName.trim()) {
        setCurrentStep(1);
      }
    } else {
      setIsSubmitting(true);
      try {
        await onCreatePlaylist(playlistName, Array.from(selectedSongs), customization);
        onClose();
        // Reset state
        setCurrentStep(0);
        setPlaylistName('');
        setSelectedSongs(new Set());
        setCustomization({ type: 'default' });
        setSearchQuery('');
        setImagePreview(null);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative w-full max-w-2xl max-h-[90vh] bg-surface-container rounded-[28px] shadow-elevation-5 border border-outline-variant/20 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
              <div>
                <h2 className="text-headline-medium font-bold text-on-surface">
                  {currentStep === 0 ? 'Create Playlist' : 'Add Songs'}
                </h2>
                <p className="text-body-small text-on-surface-variant">
                  {currentStep === 0 ? 'Customize your playlist appearance' : 'Choose songs to add'}
                </p>
              </div>
              <button
                onClick={handleBack}
                className="p-2 hover:bg-primary/10 rounded-full transition-colors text-on-surface"
              >
                {currentStep === 0 ? <x size={24} /> : <chevronRight size={24} className="rotate-180" />}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <AnimatePresence mode="wait">
                {currentStep === 0 ? (
                  <motion.div
                    key="step-0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    {/* Name Input */}
                    <div>
                      <label className="block text-label-large font-medium text-on-surface mb-3">
                        Playlist Name
                      </label>
                      <input
                        type="text"
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        placeholder="Enter playlist name"
                        className="w-full h-14 px-4 rounded-2xl bg-surface-container-highest text-on-surface text-body-large outline-none border-2 border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>

                    {/* Appearance Tabs */}
                    <div>
                      <label className="block text-label-large font-medium text-on-surface mb-3">
                        Appearance
                      </label>
                      <div className="flex gap-2 mb-4">
                        {(['default', 'image', 'icon'] as PlaylistCustomizationType[]).map((type, i) => (
                          <button
                            key={type}
                            onClick={() => setCustomization(prev => ({ ...prev, type }))}
                            className={`px-4 py-2 rounded-full font-medium transition-all ${ 
                              customization.type === type
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-highest/80'
                            }`}
                          >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </button>
                        ))}
                      </div>

                      {/* Content based on selected type */}
                      {customization.type === 'default' && (
                        <PlaylistColorPalette
                          selectedColor={customization.color}
                          onSelectColor={handleColorSelect}
                        />
                      )}

                      {customization.type === 'image' && (
                        <PlaylistImageUploader
                          preview={imagePreview}
                          onImageSelect={handleImageSelect}
                          fileInputRef={fileInputRef}
                        />
                      )}

                      {customization.type === 'icon' && (
                        <PlaylistIconCustomizer
                          selectedIcon={customization.iconName || 'MusicNote'}
                          selectedColor={customization.color}
                          onIconSelect={handleIconSelect}
                          onColorSelect={handleColorSelect}
                        />
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    {/* Search */}
                    <div className="relative">
                      <search className="absolute left-4 top-4 text-on-surface-variant" size={20} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search songs..."
                        className="w-full h-12 pl-12 pr-4 rounded-xl bg-surface-container-highest text-on-surface outline-none border-2 border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-3 p-1 hover:bg-primary/10 rounded-full"
                        >
                          <x size={18} />
                        </button>
                      )}
                    </div>

                    {/* Song List */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredSongs.length === 0 ? (
                        <div className="text-center py-8 text-on-surface-variant">
                          <music size={32} className="mx-auto mb-2 opacity-50" />
                          <p>No songs found</p>
                        </div>
                      ) : (
                        filteredSongs.map((song) => (
                          <button
                            key={song.path}
                            onClick={() => toggleSongSelection(song.path)}
                            className={`w-full p-3 rounded-xl text-left transition-all flex items-start gap-3 ${ 
                              selectedSongs.has(song.path)
                                ? 'bg-primary/20 border-2 border-primary'
                                : 'bg-surface-container-highest border-2 border-outline-variant/20 hover:bg-surface-container-highest/80'
                            }`}
                          >
                            <div className="flex-shrink-0 w-5 h-5 mt-1.5">
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${ 
                                selectedSongs.has(song.path)
                                  ? 'bg-primary border-primary'
                                  : 'border-outline-variant/50'
                              }`}>
                                {selectedSongs.has(song.path) && (
                                  <check size={16} className="text-on-primary" strokeWidth={3} />
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-body-medium font-medium text-on-surface truncate">
                                {song.title}
                              </p>
                              <p className="text-body-small text-on-surface-variant truncate">
                                {song.artist}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex gap-3 justify-end p-6 border-t border-outline-variant/10 bg-surface-container-high">
              <button
                onClick={handleBack}
                className="h-12 px-6 rounded-full text-label-large font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                {currentStep === 0 ? 'Cancel' : 'Back'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={currentStep === 0 ? !playlistName.trim() : selectedSongs.size === 0 || isSubmitting}
                className={`h-12 px-6 rounded-full text-label-large font-medium text-on-primary flex items-center gap-2 transition-all ${ 
                  (currentStep === 0 ? !playlistName.trim() : selectedSongs.size === 0 || isSubmitting)
                    ? 'bg-primary/50 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/90 shadow-elevation-3'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    {currentStep === 0 ? 'Next' : 'Create'}
                    <chevronRight size={20} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function PlaylistColorPalette({ selectedColor, onSelectColor }: { 
  selectedColor?: string; 
  onSelectColor: (color: string) => void;
}) {
  return (
    <div>
      <p className="text-body-medium text-on-surface-variant mb-3">Choose a background color</p>
      <div className="grid grid-cols-5 gap-3">
        {PLAYLIST_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onSelectColor(color)}
            className={`w-12 h-12 rounded-xl transition-all ring-2 ring-offset-2 ring-offset-surface-container ${ 
              selectedColor === color
                ? 'ring-primary ring-offset-2 shadow-lg'
                : 'ring-transparent hover:ring-primary/30'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

function PlaylistImageUploader({ 
  preview, 
  onImageSelect, 
  fileInputRef 
}: { 
  preview: string | null; 
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onImageSelect}
        className="hidden"
      />
      
      {preview ? (
        <div className="flex items-center gap-4">
          <img
            src={preview}
            alt="Preview"
            className="w-20 h-20 rounded-xl object-cover"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium text-label-large"
          >
            Change Image
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-32 rounded-xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:border-primary hover:bg-primary/5 transition-all"
        >
          <upload size={24} />
          <div className="text-center">
            <p className="text-label-large font-medium">Select an image</p>
            <p className="text-body-small">Drag and drop or click to browse</p>
          </div>
        </button>
      )}
    </div>
  );
}

function PlaylistIconCustomizer({ 
  selectedIcon, 
  selectedColor, 
  onIconSelect, 
  onColorSelect 
}: { 
  selectedIcon: string; 
  selectedColor?: string; 
  onIconSelect: (iconName: string) => void;
  onColorSelect: (color: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Color Selection */}
      <PlaylistColorPalette
        selectedColor={selectedColor}
        onSelectColor={onColorSelect}
      />

      {/* Icon Selection */}
      <div>
        <p className="text-body-medium text-on-surface-variant mb-3">Choose an icon</p>
        <div className="grid grid-cols-4 gap-3">
          {PLAYLIST_ICONS.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => onIconSelect(name)}
              className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ring-2 ring-offset-2 ring-offset-surface-container ${ 
                selectedIcon === name
                  ? 'ring-primary bg-primary/20 text-primary'
                  : 'ring-transparent bg-surface-container-highest text-on-surface-variant hover:bg-primary/10'
              }`}
            >
              <Icon size={24} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
