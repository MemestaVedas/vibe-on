use std::cmp::{max, min};
use std::collections::{BTreeSet, HashMap};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use chrono::{
    Datelike, Days, Duration as ChronoDuration, Local, LocalResult, NaiveDate, NaiveDateTime,
    TimeZone, Utc, Weekday,
};
use serde::{Deserialize, Serialize};

const MAX_REASONABLE_EVENT_DURATION_MS: i64 = 8 * 60 * 60 * 1000;
const SEGMENT_JOIN_TOLERANCE_MS: i64 = 2_000;
const SESSION_GAP_THRESHOLD_MS: i64 = 30 * 60 * 1000;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum StatsTimeRangeV2 {
    Day,
    Week,
    Month,
    Year,
    All,
}

impl StatsTimeRangeV2 {
    pub fn parse(value: Option<String>) -> Self {
        match value
            .unwrap_or_else(|| "WEEK".to_string())
            .trim()
            .to_ascii_uppercase()
            .as_str()
        {
            "DAY" => Self::Day,
            "WEEK" => Self::Week,
            "MONTH" => Self::Month,
            "YEAR" => Self::Year,
            "ALL" => Self::All,
            _ => Self::Week,
        }
    }

    fn display_name(&self) -> &'static str {
        match self {
            Self::Day => "Today",
            Self::Week => "This Week",
            Self::Month => "This Month",
            Self::Year => "This Year",
            Self::All => "All Time",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SongPlaybackSummaryV2 {
    pub song_id: String,
    pub title: String,
    pub artist: String,
    pub album_art_url: Option<String>,
    pub total_duration_ms: i64,
    pub play_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistPlaybackSummaryV2 {
    pub artist: String,
    pub total_duration_ms: i64,
    pub play_count: i64,
    pub unique_songs: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenrePlaybackSummaryV2 {
    pub genre: String,
    pub total_duration_ms: i64,
    pub play_count: i64,
    pub unique_artists: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumPlaybackSummaryV2 {
    pub album: String,
    pub album_art_url: Option<String>,
    pub total_duration_ms: i64,
    pub play_count: i64,
    pub unique_songs: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEntryV2 {
    pub label: String,
    pub total_duration_ms: i64,
    pub play_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyListeningBucketV2 {
    pub start_minute: i64,
    pub end_minute_exclusive: i64,
    pub total_duration_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyListeningDayV2 {
    pub date: String,
    pub buckets: Vec<DailyListeningBucketV2>,
    pub total_duration_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayListeningDistributionV2 {
    pub bucket_size_minutes: i64,
    pub buckets: Vec<DailyListeningBucketV2>,
    pub max_bucket_duration_ms: i64,
    pub days: Vec<DailyListeningDayV2>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackStatsSummaryV2 {
    pub range: StatsTimeRangeV2,
    pub range_display_name: String,
    pub start_timestamp: Option<i64>,
    pub end_timestamp: i64,
    pub total_duration_ms: i64,
    pub total_play_count: i64,
    pub unique_songs: i64,
    pub average_daily_duration_ms: i64,
    pub songs: Vec<SongPlaybackSummaryV2>,
    pub top_songs: Vec<SongPlaybackSummaryV2>,
    pub top_genres: Vec<GenrePlaybackSummaryV2>,
    pub timeline: Vec<TimelineEntryV2>,
    pub top_artists: Vec<ArtistPlaybackSummaryV2>,
    pub top_albums: Vec<AlbumPlaybackSummaryV2>,
    pub active_days: i64,
    pub longest_streak_days: i64,
    pub total_sessions: i64,
    pub average_session_duration_ms: i64,
    pub longest_session_duration_ms: i64,
    pub average_sessions_per_day: f64,
    pub day_listening_distribution: Option<DayListeningDistributionV2>,
    pub peak_timeline: Option<TimelineEntryV2>,
    pub peak_day_label: Option<String>,
    pub peak_day_duration_ms: i64,
}

#[derive(Debug, Clone)]
struct PlaybackSegment {
    start_millis: i64,
    end_millis: i64,
}

impl PlaybackSegment {
    fn duration_ms(&self) -> i64 {
        (self.end_millis - self.start_millis).max(0)
    }
}

#[derive(Debug, Clone)]
struct PlaybackSpan {
    start_millis: i64,
    end_millis: i64,
}

impl PlaybackSpan {
    fn duration_ms(&self) -> i64 {
        (self.end_millis - self.start_millis).max(0)
    }
}

#[derive(Debug, Clone)]
struct TimelineBucket {
    label: String,
    start_millis: i64,
    end_millis: i64,
    inclusive_end: bool,
}

#[derive(Debug, Clone)]
struct DaySlice {
    date: NaiveDate,
    duration_ms: i64,
}

#[derive(Debug, Clone)]
struct ListeningSessionAggregate {
    end: i64,
    total_duration: i64,
}

#[derive(Debug, Clone)]
struct TrackMeta {
    song_id: String,
    title: String,
    artist: String,
    album: String,
    album_art_url: Option<String>,
    duration_ms: Option<i64>,
    genre: Option<String>,
}

pub fn get_stats_v2(
    app_state: &crate::AppState,
    selected_range: Option<String>,
) -> Result<PlaybackStatsSummaryV2, String> {
    let range = StatsTimeRangeV2::parse(selected_range);
    let now_ms = current_time_ms();

    let guard = app_state.db.lock().map_err(|_| "db lock poisoned".to_string())?;
    let db = guard.as_ref().ok_or("database not initialized")?;

    let tracks = db
        .get_all_tracks()
        .map_err(|e| format!("load tracks for stats v2: {e}"))?;
    let events = db
        .load_playback_events(None, None)
        .map_err(|e| format!("load playback events for stats v2: {e}"))?;

    let track_meta: HashMap<String, TrackMeta> = tracks
        .into_iter()
        .map(|t| {
            let duration_ms = if t.duration_secs > 0.0 {
                Some((t.duration_secs * 1000.0) as i64)
            } else {
                None
            };
            (
                t.path.clone(),
                TrackMeta {
                    song_id: t.path,
                    title: t.title,
                    artist: t.artist,
                    album: t.album,
                    album_art_url: t.cover_image,
                    duration_ms,
                    genre: None,
                },
            )
        })
        .collect();

    Ok(load_summary(range, &track_meta, &events, now_ms))
}

fn load_summary(
    range: StatsTimeRangeV2,
    tracks: &HashMap<String, TrackMeta>,
    events: &[crate::stats::PlaybackEvent],
    now_ms: i64,
) -> PlaybackStatsSummaryV2 {
    let (start_bound, end_bound) = resolve_bounds(&range, events, now_ms);

    let filtered_events: Vec<crate::stats::PlaybackEvent> = events
        .iter()
        .filter_map(|event| {
            let start = event_start_millis(event);
            let end = event_end_millis(event);
            let lower_bound = start_bound.unwrap_or(i64::MIN);
            if end < lower_bound || start > end_bound {
                return None;
            }

            let clipped_start = max(start, lower_bound);
            let clipped_end = min(end, end_bound);
            let clipped_duration = (clipped_end - clipped_start).max(0);
            let base_duration = event.duration_ms.max(0);
            let effective_duration = if clipped_duration > 0 {
                clipped_duration
            } else if base_duration > 0 {
                base_duration
            } else {
                0
            };
            if effective_duration <= 0 {
                return None;
            }

            Some(crate::stats::PlaybackEvent {
                song_id: event.song_id.clone(),
                timestamp: clipped_end,
                duration_ms: effective_duration,
                start_timestamp: Some(clipped_start),
                end_timestamp: Some(clipped_end),
                output: event.output.clone(),
            })
        })
        .collect();

    let normalized_events: Vec<crate::stats::PlaybackEvent> = filtered_events
        .into_iter()
        .map(|event| {
            let song_id = event.song_id.clone();
            normalize_event_duration(event, tracks.get(&song_id))
        })
        .collect();

    let mut grouped: HashMap<String, Vec<crate::stats::PlaybackEvent>> = HashMap::new();
    for event in normalized_events {
        grouped.entry(event.song_id.clone()).or_default().push(event);
    }

    let mut segments_by_song: HashMap<String, Vec<PlaybackSegment>> = HashMap::new();
    for (song_id, song_events) in grouped {
        let merged = merge_song_events(song_events);
        if !merged.is_empty() {
            segments_by_song.insert(song_id, merged);
        }
    }

    let all_spans_input: Vec<PlaybackSpan> = segments_by_song
        .values()
        .flat_map(|segments| {
            segments.iter().map(|segment| PlaybackSpan {
                start_millis: segment.start_millis,
                end_millis: segment.end_millis,
            })
        })
        .collect();
    let overall_spans = merge_spans(all_spans_input);

    let effective_start = start_bound
        .or_else(|| overall_spans.iter().map(|s| s.start_millis).min())
        .or_else(|| events.iter().map(event_start_millis).min());
    let effective_end = overall_spans
        .iter()
        .map(|s| s.end_millis)
        .max()
        .unwrap_or(end_bound);

    let total_duration: i64 = overall_spans.iter().map(PlaybackSpan::duration_ms).sum();
    let total_plays: i64 = segments_by_song.values().map(|s| s.len() as i64).sum();
    let unique_songs = segments_by_song.len() as i64;

    let mut all_songs: Vec<SongPlaybackSummaryV2> = segments_by_song
        .iter()
        .filter_map(|(song_id, segments)| {
            let song = tracks.get(song_id)?;
            let title = if !song.title.trim().is_empty() {
                song.title.clone()
            } else {
                song.song_id
                    .split(['/', '\\'])
                    .last()
                    .unwrap_or("Unknown Track")
                    .to_string()
            };
            let artist = if !song.artist.trim().is_empty() {
                song.artist.clone()
            } else {
                "Unknown Artist".to_string()
            };
            Some(SongPlaybackSummaryV2 {
                song_id: song_id.clone(),
                title,
                artist,
                album_art_url: song.album_art_url.clone(),
                total_duration_ms: segments.iter().map(PlaybackSegment::duration_ms).sum(),
                play_count: segments.len() as i64,
            })
        })
        .collect();
    all_songs.sort_by(|a, b| {
        b.total_duration_ms
            .cmp(&a.total_duration_ms)
            .then_with(|| b.play_count.cmp(&a.play_count))
    });
    let top_songs = all_songs.iter().take(5).cloned().collect::<Vec<_>>();

    let mut genre_map: HashMap<String, Vec<(String, PlaybackSegment)>> = HashMap::new();
    for (song_id, segments) in &segments_by_song {
        let genre = tracks
            .get(song_id)
            .and_then(|meta| meta.genre.clone())
            .filter(|g| !g.trim().is_empty())
            .unwrap_or_else(|| "Unknown Genre".to_string());

        for segment in segments {
            genre_map
                .entry(genre.clone())
                .or_default()
                .push((song_id.clone(), segment.clone()));
        }
    }

    let mut top_genres = genre_map
        .into_iter()
        .map(|(genre, grouped_segments)| {
            let total_duration_ms = grouped_segments
                .iter()
                .map(|(_, segment)| segment.duration_ms())
                .sum();
            let play_count = grouped_segments.len() as i64;
            let unique_artists: BTreeSet<String> = grouped_segments
                .iter()
                .filter_map(|(song_id, _)| tracks.get(song_id))
                .map(|song| {
                    if song.artist.trim().is_empty() {
                        "Unknown Artist".to_string()
                    } else {
                        song.artist.clone()
                    }
                })
                .collect();
            GenrePlaybackSummaryV2 {
                genre,
                total_duration_ms,
                play_count,
                unique_artists: unique_artists.len() as i64,
            }
        })
        .collect::<Vec<_>>();
    top_genres.sort_by(|a, b| {
        b.total_duration_ms
            .cmp(&a.total_duration_ms)
            .then_with(|| b.play_count.cmp(&a.play_count))
    });
    top_genres.truncate(5);

    let day_span = if let Some(start_ms) = effective_start {
        let start_date = to_local_date(start_ms);
        let end_date = to_local_date(effective_end);
        max(1, (end_date - start_date).num_days() + 1)
    } else {
        1
    };
    let average_daily_duration = if day_span > 0 {
        total_duration / day_span
    } else {
        total_duration
    };

    let day_slices = overall_spans
        .iter()
        .flat_map(|span| slice_span_by_day(span))
        .collect::<Vec<_>>();

    let mut events_by_day: HashMap<NaiveDate, i64> = HashMap::new();
    for slice in &day_slices {
        *events_by_day.entry(slice.date).or_insert(0) += slice.duration_ms;
    }

    let mut sorted_days = events_by_day.keys().cloned().collect::<Vec<_>>();
    sorted_days.sort();
    let active_days = sorted_days.len() as i64;

    let mut longest_streak = 0_i64;
    let mut current_streak = 0_i64;
    let mut last_day: Option<NaiveDate> = None;
    for day in &sorted_days {
        if let Some(prev) = last_day {
            if *day == prev + ChronoDuration::days(1) {
                current_streak += 1;
            } else {
                current_streak = 1;
            }
        } else {
            current_streak = 1;
        }
        if current_streak > longest_streak {
            longest_streak = current_streak;
        }
        last_day = Some(*day);
    }

    let sessions = compute_listening_sessions(&overall_spans);
    let total_sessions = sessions.len() as i64;
    let total_session_duration: i64 = sessions.iter().map(|s| s.total_duration).sum();
    let average_session_duration = if total_sessions > 0 {
        total_session_duration / total_sessions
    } else {
        0
    };
    let longest_session_duration = sessions
        .iter()
        .map(|s| s.total_duration)
        .max()
        .unwrap_or(0);
    let average_sessions_per_day = if day_span > 0 {
        total_sessions as f64 / day_span as f64
    } else {
        0.0
    };

    let timeline_buckets = create_timeline_buckets(
        &range,
        end_bound,
        &overall_spans,
        effective_start.unwrap_or(end_bound),
    );
    let timeline_entries = accumulate_timeline_entries(&timeline_buckets, &overall_spans);

    let mut artist_map: HashMap<String, Vec<(String, PlaybackSegment)>> = HashMap::new();
    for (song_id, segments) in &segments_by_song {
        let artist = tracks
            .get(song_id)
            .map(|song| {
                if song.artist.trim().is_empty() {
                    "Unknown Artist".to_string()
                } else {
                    song.artist.clone()
                }
            })
            .unwrap_or_else(|| "Unknown Artist".to_string());

        for segment in segments {
            artist_map
                .entry(artist.clone())
                .or_default()
                .push((song_id.clone(), segment.clone()));
        }
    }

    let mut top_artists = artist_map
        .into_iter()
        .map(|(artist, grouped_segments)| {
            let total_duration_ms = grouped_segments
                .iter()
                .map(|(_, segment)| segment.duration_ms())
                .sum();
            let play_count = grouped_segments.len() as i64;
            let unique_songs: BTreeSet<String> = grouped_segments
                .iter()
                .map(|(song_id, _)| song_id.clone())
                .collect();
            ArtistPlaybackSummaryV2 {
                artist,
                total_duration_ms,
                play_count,
                unique_songs: unique_songs.len() as i64,
            }
        })
        .collect::<Vec<_>>();
    top_artists.sort_by(|a, b| {
        b.total_duration_ms
            .cmp(&a.total_duration_ms)
            .then_with(|| b.play_count.cmp(&a.play_count))
    });
    top_artists.truncate(5);

    let mut album_map: HashMap<String, Vec<(String, PlaybackSegment)>> = HashMap::new();
    for (song_id, segments) in &segments_by_song {
        let album = tracks
            .get(song_id)
            .map(|song| {
                if song.album.trim().is_empty() {
                    "Unknown Album".to_string()
                } else {
                    song.album.clone()
                }
            })
            .unwrap_or_else(|| "Unknown Album".to_string());

        for segment in segments {
            album_map
                .entry(album.clone())
                .or_default()
                .push((song_id.clone(), segment.clone()));
        }
    }

    let mut top_albums = album_map
        .into_iter()
        .map(|(album, grouped_segments)| {
            let total_duration_ms = grouped_segments
                .iter()
                .map(|(_, segment)| segment.duration_ms())
                .sum();
            let play_count = grouped_segments.len() as i64;
            let unique_songs: BTreeSet<String> = grouped_segments
                .iter()
                .map(|(song_id, _)| song_id.clone())
                .collect();

            let album_art_url = grouped_segments
                .iter()
                .find_map(|(song_id, _)| tracks.get(song_id).and_then(|t| t.album_art_url.clone()));

            AlbumPlaybackSummaryV2 {
                album,
                album_art_url,
                total_duration_ms,
                play_count,
                unique_songs: unique_songs.len() as i64,
            }
        })
        .collect::<Vec<_>>();
    top_albums.sort_by(|a, b| {
        b.total_duration_ms
            .cmp(&a.total_duration_ms)
            .then_with(|| b.play_count.cmp(&a.play_count))
    });
    top_albums.truncate(5);

    let peak_timeline = timeline_entries
        .iter()
        .filter(|entry| entry.total_duration_ms > 0)
        .max_by_key(|entry| entry.total_duration_ms)
        .cloned();

    let mut by_weekday: HashMap<Weekday, i64> = HashMap::new();
    for slice in &day_slices {
        let weekday = slice.date.weekday();
        *by_weekday.entry(weekday).or_insert(0) += slice.duration_ms;
    }

    let peak_day = by_weekday.into_iter().max_by_key(|(_, duration)| *duration);
    let peak_day_label = peak_day
        .as_ref()
        .map(|(weekday, _)| weekday_name(*weekday).to_string());
    let peak_day_duration_ms = peak_day.map(|(_, duration)| duration).unwrap_or(0);

    let day_listening_distribution = compute_day_listening_distribution(
        &overall_spans,
        &range,
        start_bound,
        end_bound,
        5,
    );

    PlaybackStatsSummaryV2 {
        range,
        range_display_name: range.display_name().to_string(),
        start_timestamp: start_bound,
        end_timestamp: end_bound,
        total_duration_ms: total_duration,
        total_play_count: total_plays,
        unique_songs,
        average_daily_duration_ms: average_daily_duration,
        songs: all_songs,
        top_songs,
        top_genres,
        timeline: timeline_entries,
        top_artists,
        top_albums,
        active_days,
        longest_streak_days: longest_streak,
        total_sessions,
        average_session_duration_ms: average_session_duration,
        longest_session_duration_ms: longest_session_duration,
        average_sessions_per_day,
        day_listening_distribution,
        peak_timeline,
        peak_day_label,
        peak_day_duration_ms,
    }
}

fn normalize_event_duration(
    event: crate::stats::PlaybackEvent,
    song: Option<&TrackMeta>,
) -> crate::stats::PlaybackEvent {
    let safe_end = event_end_millis(&event);
    let track_duration = song.and_then(|track| track.duration_ms.filter(|d| *d > 0));
    let bounded_duration = min(
        track_duration
            .map(|track_duration_ms| min(event.duration_ms.max(0), track_duration_ms))
            .unwrap_or_else(|| event.duration_ms.max(0)),
        MAX_REASONABLE_EVENT_DURATION_MS,
    );
    let adjusted_start = max(safe_end - bounded_duration, 0);

    if bounded_duration == event.duration_ms && adjusted_start == event_start_millis(&event) {
        return event;
    }

    crate::stats::PlaybackEvent {
        song_id: event.song_id,
        timestamp: safe_end,
        duration_ms: bounded_duration,
        start_timestamp: Some(adjusted_start),
        end_timestamp: Some(safe_end),
        output: event.output,
    }
}

fn merge_song_events(events: Vec<crate::stats::PlaybackEvent>) -> Vec<PlaybackSegment> {
    if events.is_empty() {
        return Vec::new();
    }

    let mut sorted = events;
    sorted.sort_by_key(event_start_millis);

    let mut segments = Vec::new();

    let mut current_start = event_start_millis(&sorted[0]);
    let mut current_end = event_end_millis(&sorted[0]);

    for event in sorted.iter().skip(1) {
        let start = event_start_millis(event);
        let end = event_end_millis(event);

        if start <= current_end + SEGMENT_JOIN_TOLERANCE_MS {
            current_end = max(current_end, end);
        } else {
            segments.push(PlaybackSegment {
                start_millis: current_start,
                end_millis: current_end,
            });
            current_start = start;
            current_end = end;
        }
    }

    segments.push(PlaybackSegment {
        start_millis: current_start,
        end_millis: current_end,
    });

    segments
}

fn merge_spans(mut spans: Vec<PlaybackSpan>) -> Vec<PlaybackSpan> {
    if spans.is_empty() {
        return Vec::new();
    }

    spans.sort_by_key(|span| span.start_millis);

    let mut merged = Vec::new();
    let mut current_start = spans[0].start_millis;
    let mut current_end = spans[0].end_millis;

    for span in spans.iter().skip(1) {
        if span.start_millis <= current_end + SEGMENT_JOIN_TOLERANCE_MS {
            current_end = max(current_end, span.end_millis);
        } else {
            merged.push(PlaybackSpan {
                start_millis: current_start,
                end_millis: current_end,
            });
            current_start = span.start_millis;
            current_end = span.end_millis;
        }
    }

    merged.push(PlaybackSpan {
        start_millis: current_start,
        end_millis: current_end,
    });

    merged
}

fn slice_span_by_day(span: &PlaybackSpan) -> Vec<DaySlice> {
    if span.duration_ms() <= 0 {
        return Vec::new();
    }

    let mut slices = Vec::new();
    let mut cursor = span.start_millis;
    let end = span.end_millis;

    while cursor < end {
        let day = to_local_date(cursor);
        let day_start = local_day_start_millis(day);
        let next_day = day.checked_add_days(Days::new(1)).unwrap_or(day);
        let next_day_start = local_day_start_millis(next_day);

        let _ = day_start;
        let slice_end = min(end, next_day_start);
        let slice_duration = (slice_end - cursor).max(0);
        if slice_duration > 0 {
            slices.push(DaySlice {
                date: day,
                duration_ms: slice_duration,
            });
        }

        cursor = slice_end;
    }

    slices
}

fn compute_listening_sessions(spans: &[PlaybackSpan]) -> Vec<ListeningSessionAggregate> {
    if spans.is_empty() {
        return Vec::new();
    }

    let mut sorted = spans.to_vec();
    sorted.sort_by_key(|span| span.start_millis);

    let mut sessions = Vec::new();

    let mut current = ListeningSessionAggregate {
        end: sorted[0].end_millis,
        total_duration: sorted[0].duration_ms(),
    };

    for span in sorted.iter().skip(1) {
        let gap = span.start_millis - current.end;
        if gap <= SESSION_GAP_THRESHOLD_MS {
            current.end = max(current.end, span.end_millis);
            current.total_duration += span.duration_ms();
        } else {
            sessions.push(current);
            current = ListeningSessionAggregate {
                end: span.end_millis,
                total_duration: span.duration_ms(),
            };
        }
    }

    sessions.push(current);
    sessions
}

fn accumulate_timeline_entries(
    buckets: &[TimelineBucket],
    spans: &[PlaybackSpan],
) -> Vec<TimelineEntryV2> {
    if buckets.is_empty() {
        return Vec::new();
    }

    let mut duration_by_bucket = vec![0_i64; buckets.len()];
    let mut play_count_by_bucket = vec![0_f64; buckets.len()];

    for span in spans {
        let span_start = span.start_millis;
        let span_end = span.end_millis;
        let span_duration = span.duration_ms();
        if span_duration <= 0 {
            continue;
        }

        for (index, bucket) in buckets.iter().enumerate() {
            let bucket_end_exclusive = if bucket.inclusive_end {
                bucket.end_millis.saturating_add(1)
            } else {
                bucket.end_millis
            };

            let overlap_start = max(span_start, bucket.start_millis);
            let overlap_end = min(span_end, bucket_end_exclusive);
            let overlap = (overlap_end - overlap_start).max(0);
            if overlap > 0 {
                duration_by_bucket[index] += overlap;
                play_count_by_bucket[index] += overlap as f64 / span_duration as f64;
            }
        }
    }

    buckets
        .iter()
        .enumerate()
        .map(|(index, bucket)| TimelineEntryV2 {
            label: bucket.label.clone(),
            total_duration_ms: duration_by_bucket[index],
            play_count: play_count_by_bucket[index].round() as i64,
        })
        .collect()
}

fn create_timeline_buckets(
    range: &StatsTimeRangeV2,
    now_ms: i64,
    spans: &[PlaybackSpan],
    fallback_start: i64,
) -> Vec<TimelineBucket> {
    match range {
        StatsTimeRangeV2::Day => create_day_buckets(now_ms),
        StatsTimeRangeV2::Week => create_week_buckets(now_ms),
        StatsTimeRangeV2::Month => create_month_buckets(now_ms),
        StatsTimeRangeV2::Year => create_year_buckets(now_ms),
        StatsTimeRangeV2::All => create_all_time_buckets(spans, fallback_start, now_ms),
    }
}

fn create_day_buckets(now_ms: i64) -> Vec<TimelineBucket> {
    let day_start = local_day_start_millis(to_local_date(now_ms));

    (0..6)
        .map(|index| {
            let bucket_start = day_start + index * 4 * 60 * 60 * 1000;
            let bucket_end = bucket_start + 4 * 60 * 60 * 1000;
            let label = Utc
                .timestamp_millis_opt(bucket_start)
                .single()
                .map(|dt| dt.with_timezone(&Local).format("%-I%P").to_string())
                .unwrap_or_else(|| format!("{}h", index * 4));

            TimelineBucket {
                label,
                start_millis: bucket_start,
                end_millis: bucket_end,
                inclusive_end: false,
            }
        })
        .collect()
}

fn create_week_buckets(now_ms: i64) -> Vec<TimelineBucket> {
    let today = to_local_date(now_ms);
    let week_start = today
        - ChronoDuration::days(today.weekday().num_days_from_monday() as i64);

    (0..7)
        .map(|offset| {
            let day = week_start + ChronoDuration::days(offset as i64);
            let start = local_day_start_millis(day);
            let end = local_day_start_millis(day.checked_add_days(Days::new(1)).unwrap_or(day));
            TimelineBucket {
                label: weekday_short(day.weekday()).to_string(),
                start_millis: start,
                end_millis: end,
                inclusive_end: false,
            }
        })
        .collect()
}

fn create_month_buckets(now_ms: i64) -> Vec<TimelineBucket> {
    let today = to_local_date(now_ms);
    let first_day = NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap_or(today);
    let days_in_month = days_in_month(today.year(), today.month());

    (0..4)
        .filter_map(|index| {
            let start_day = index * 7 + 1;
            if start_day > days_in_month {
                return None;
            }
            let end_day = if index == 3 {
                days_in_month
            } else {
                min(start_day + 6, days_in_month)
            };

            let start = local_day_start_millis(
                NaiveDate::from_ymd_opt(today.year(), today.month(), start_day as u32)
                    .unwrap_or(first_day),
            );
            let end_date = NaiveDate::from_ymd_opt(today.year(), today.month(), end_day as u32)
                .unwrap_or(first_day);
            let next = end_date.checked_add_days(Days::new(1)).unwrap_or(end_date);
            let end = local_day_start_millis(next);

            Some(TimelineBucket {
                label: format!("Week {}", index + 1),
                start_millis: start,
                end_millis: end,
                inclusive_end: false,
            })
        })
        .collect()
}

fn create_year_buckets(now_ms: i64) -> Vec<TimelineBucket> {
    let today = to_local_date(now_ms);
    (1..=12)
        .map(|month| {
            let start_date = NaiveDate::from_ymd_opt(today.year(), month, 1).unwrap_or(today);
            let next_month_date = if month == 12 {
                NaiveDate::from_ymd_opt(today.year() + 1, 1, 1).unwrap_or(start_date)
            } else {
                NaiveDate::from_ymd_opt(today.year(), month + 1, 1).unwrap_or(start_date)
            };

            TimelineBucket {
                label: month_short(month),
                start_millis: local_day_start_millis(start_date),
                end_millis: local_day_start_millis(next_month_date),
                inclusive_end: false,
            }
        })
        .collect()
}

fn create_all_time_buckets(
    spans: &[PlaybackSpan],
    fallback_start: i64,
    now_ms: i64,
) -> Vec<TimelineBucket> {
    let min_timestamp = spans
        .iter()
        .map(|span| span.start_millis)
        .min()
        .unwrap_or(fallback_start);
    let max_timestamp = spans
        .iter()
        .map(|span| span.end_millis)
        .max()
        .unwrap_or(now_ms);

    let start_year = to_local_date(min_timestamp).year();
    let end_year = to_local_date(max_timestamp).year();
    if start_year > end_year {
        return Vec::new();
    }

    (start_year..=end_year)
        .map(|year| {
            let start_date = NaiveDate::from_ymd_opt(year, 1, 1)
                .unwrap_or_else(|| to_local_date(min_timestamp));
            let next_year = NaiveDate::from_ymd_opt(year + 1, 1, 1)
                .unwrap_or_else(|| to_local_date(max_timestamp));

            TimelineBucket {
                label: year.to_string(),
                start_millis: local_day_start_millis(start_date),
                end_millis: local_day_start_millis(next_year),
                inclusive_end: false,
            }
        })
        .collect()
}

fn compute_day_listening_distribution(
    spans: &[PlaybackSpan],
    range: &StatsTimeRangeV2,
    start_bound: Option<i64>,
    end_bound: i64,
    bucket_size_minutes: i64,
) -> Option<DayListeningDistributionV2> {
    if spans.is_empty() {
        return None;
    }

    let bucket_duration_ms = bucket_size_minutes * 60 * 1000;
    let bucket_count = (24 * 60 / bucket_size_minutes).max(1) as usize;

    let mut totals = vec![0_i64; bucket_count];
    let mut totals_by_day: HashMap<NaiveDate, Vec<i64>> = HashMap::new();

    for span in spans {
        let mut cursor = span.start_millis;
        let end = span.end_millis;

        while cursor < end {
            let day = to_local_date(cursor);
            let day_start = local_day_start_millis(day);
            let mut bucket_index = ((cursor - day_start) / bucket_duration_ms) as isize;
            if bucket_index < 0 {
                bucket_index = 0;
            }
            if bucket_index as usize >= bucket_count {
                bucket_index = bucket_count as isize - 1;
            }

            let bucket_start = day_start + bucket_index as i64 * bucket_duration_ms;
            let bucket_end = min(end, bucket_start + bucket_duration_ms);
            let contribution = (bucket_end - cursor).max(0);

            if contribution > 0 {
                totals[bucket_index as usize] += contribution;
                let day_totals = totals_by_day
                    .entry(day)
                    .or_insert_with(|| vec![0_i64; bucket_count]);
                day_totals[bucket_index as usize] += contribution;
            }

            cursor = if bucket_end > cursor { bucket_end } else { end };
        }
    }

    let buckets = (0..bucket_count)
        .filter_map(|index| {
            let duration_ms = totals[index];
            if duration_ms <= 0 {
                return None;
            }
            Some(DailyListeningBucketV2 {
                start_minute: (index as i64) * bucket_size_minutes,
                end_minute_exclusive: ((index as i64) + 1) * bucket_size_minutes,
                total_duration_ms: duration_ms,
            })
        })
        .collect::<Vec<_>>();

    if buckets.is_empty() {
        return None;
    }

    let max_bucket_duration_ms = buckets
        .iter()
        .map(|bucket| bucket.total_duration_ms)
        .max()
        .unwrap_or(0)
        .max(0);

    let day_sequence: Vec<NaiveDate> = match range {
        StatsTimeRangeV2::Day => {
            let anchor = start_bound
                .map(to_local_date)
                .or_else(|| spans.iter().map(|s| to_local_date(s.start_millis)).min())
                .unwrap_or_else(|| to_local_date(end_bound));
            vec![anchor]
        }
        StatsTimeRangeV2::Week => {
            let anchor = start_bound
                .map(to_local_date)
                .or_else(|| spans.iter().map(|s| to_local_date(s.start_millis)).min())
                .unwrap_or_else(|| to_local_date(end_bound));
            (0..7)
                .map(|offset| anchor + ChronoDuration::days(offset))
                .collect()
        }
        _ => {
            let mut keys = totals_by_day.keys().cloned().collect::<Vec<_>>();
            keys.sort();
            keys
        }
    };

    let days = day_sequence
        .into_iter()
        .map(|date| {
            let bucket_totals = totals_by_day.get(&date).cloned().unwrap_or_default();
            let buckets = if bucket_totals.is_empty() {
                Vec::new()
            } else {
                bucket_totals
                    .iter()
                    .enumerate()
                    .filter_map(|(index, duration)| {
                        if *duration <= 0 {
                            return None;
                        }
                        Some(DailyListeningBucketV2 {
                            start_minute: (index as i64) * bucket_size_minutes,
                            end_minute_exclusive: ((index as i64) + 1) * bucket_size_minutes,
                            total_duration_ms: *duration,
                        })
                    })
                    .collect()
            };
            let total_duration_ms = bucket_totals.iter().sum();

            DailyListeningDayV2 {
                date: date.to_string(),
                buckets,
                total_duration_ms,
            }
        })
        .collect();

    Some(DayListeningDistributionV2 {
        bucket_size_minutes,
        buckets,
        max_bucket_duration_ms,
        days,
    })
}

fn resolve_bounds(
    range: &StatsTimeRangeV2,
    events: &[crate::stats::PlaybackEvent],
    now_ms: i64,
) -> (Option<i64>, i64) {
    let now_date = to_local_date(now_ms);

    match range {
        StatsTimeRangeV2::Day => (Some(local_day_start_millis(now_date)), now_ms),
        StatsTimeRangeV2::Week => {
            let week_start = now_date
                - ChronoDuration::days(now_date.weekday().num_days_from_monday() as i64);
            (Some(local_day_start_millis(week_start)), now_ms)
        }
        StatsTimeRangeV2::Month => {
            let month_start = NaiveDate::from_ymd_opt(now_date.year(), now_date.month(), 1)
                .unwrap_or(now_date);
            (Some(local_day_start_millis(month_start)), now_ms)
        }
        StatsTimeRangeV2::Year => {
            let year_start = NaiveDate::from_ymd_opt(now_date.year(), 1, 1).unwrap_or(now_date);
            (Some(local_day_start_millis(year_start)), now_ms)
        }
        StatsTimeRangeV2::All => {
            let start = events.iter().map(event_start_millis).min();
            (start, now_ms)
        }
    }
}

fn event_start_millis(event: &crate::stats::PlaybackEvent) -> i64 {
    let end = event.end_timestamp.unwrap_or(event.timestamp).max(0);
    let inferred_start = event
        .start_timestamp
        .unwrap_or(end.saturating_sub(event.duration_ms))
        .max(0);
    min(inferred_start, end)
}

fn event_end_millis(event: &crate::stats::PlaybackEvent) -> i64 {
    let end = event.end_timestamp.unwrap_or(event.timestamp).max(0);
    let start = event_start_millis(event);
    max(end, start)
}

fn to_local_date(ms: i64) -> NaiveDate {
    Utc.timestamp_millis_opt(ms)
        .single()
        .map(|dt| dt.with_timezone(&Local).date_naive())
        .unwrap_or_else(|| Local::now().date_naive())
}

fn local_day_start_millis(date: NaiveDate) -> i64 {
    let dt = date
        .and_hms_opt(0, 0, 0)
        .unwrap_or_else(|| NaiveDateTime::new(date, chrono::NaiveTime::MIN));
    match Local.from_local_datetime(&dt) {
        LocalResult::Single(local_dt) => local_dt.timestamp_millis(),
        LocalResult::Ambiguous(earliest, _) => earliest.timestamp_millis(),
        LocalResult::None => {
            let mut shifted = dt;
            for _ in 0..6 {
                shifted += ChronoDuration::hours(1);
                if let LocalResult::Single(local_dt) = Local.from_local_datetime(&shifted) {
                    return local_dt.timestamp_millis();
                }
            }
            Local::now().timestamp_millis()
        }
    }
}

fn weekday_short(day: Weekday) -> &'static str {
    match day {
        Weekday::Mon => "Mon",
        Weekday::Tue => "Tue",
        Weekday::Wed => "Wed",
        Weekday::Thu => "Thu",
        Weekday::Fri => "Fri",
        Weekday::Sat => "Sat",
        Weekday::Sun => "Sun",
    }
}

fn weekday_name(day: Weekday) -> &'static str {
    match day {
        Weekday::Mon => "Monday",
        Weekday::Tue => "Tuesday",
        Weekday::Wed => "Wednesday",
        Weekday::Thu => "Thursday",
        Weekday::Fri => "Friday",
        Weekday::Sat => "Saturday",
        Weekday::Sun => "Sunday",
    }
}

fn month_short(month: u32) -> String {
    match month {
        1 => "Jan",
        2 => "Feb",
        3 => "Mar",
        4 => "Apr",
        5 => "May",
        6 => "Jun",
        7 => "Jul",
        8 => "Aug",
        9 => "Sep",
        10 => "Oct",
        11 => "Nov",
        12 => "Dec",
        _ => "--",
    }
    .to_string()
}

fn days_in_month(year: i32, month: u32) -> i64 {
    let next_month = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    };

    let this_month = NaiveDate::from_ymd_opt(year, month, 1);

    match (this_month, next_month) {
        (Some(start), Some(end)) => (end - start).num_days(),
        _ => 30,
    }
}

fn current_time_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| Duration::from_millis(0))
        .as_millis() as i64
}
