// Player state enum matching Rust
export type PlayerState = 'Stopped' | 'Playing' | 'Paused';

// Track info matching Rust struct
export interface TrackInfo {
  path: string;
  title: string;
  artist: string;
  album: string;
  duration_secs: number;
  cover_image?: string | null;
  cover_url?: string; // For streaming services
}

// Complete player status matching Rust struct
export interface PlayerStatus {
  state: PlayerState;
  track: TrackInfo | null;
  position_secs: number;
  volume: number;
}

// Track display info for library
export interface TrackDisplay extends TrackInfo {
  id: string; // Use path as unique ID
}
