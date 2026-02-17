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
  disc_number?: number | null;
  track_number?: number | null;
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

  // Metadata Indexing
  title_romaji?: string | null;
  title_en?: string | null;
  artist_romaji?: string | null;
  artist_en?: string | null;
  album_romaji?: string | null;
  album_en?: string | null;
}

// Lyrics line with timestamp for synced lyrics
export interface LyricsLine {
  time: number;  // Timestamp in seconds
  text: string;  // Lyric line content
  romaji?: string; // Romaji translation
}

// Lyrics response from backend
export interface LyricsData {
  syncedLyrics: string | null;  // LRC format string
  plainLyrics: string | null;   // Plain text fallback
  instrumental: boolean;
}

// Playback mode for seamless video switching
export type PlaybackMode = 'audio' | 'video';

// Content type filters for unreleased library
export type ContentType = 'slowed_reverb' | 'loop' | 'live' | 'remix' | 'other';

// Unreleased track from YouTube (user-uploaded content)
export interface UnreleasedTrack extends TrackInfo {
  video_id: string;           // YouTube video ID
  thumbnail_url?: string;     // Video thumbnail
  content_type: ContentType;  // Type of content
  channel_name?: string;      // Uploader name
  view_count?: number;        // View count
  added_at?: number;          // Unix timestamp when added to library
}

// Search filter for finding unreleased content
export interface UnreleasedSearchFilter {
  content_type?: ContentType;
  max_results?: number;
}

// Playlist interface matching Backend
export interface Playlist {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PlaylistTrack extends TrackInfo {
  playlist_track_id: number;
}

export type AppView = 'tracks' | 'albums' | 'artists' | 'settings' | 'ytmusic' | 'favorites' | 'statistics' | 'torrents' | 'playlist';
