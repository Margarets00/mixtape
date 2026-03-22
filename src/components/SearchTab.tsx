import { useRef, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Channel } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { SearchResultRow } from './SearchResultRow';
import type { SearchResult } from './SearchResultRow';
import { PlaylistTrackRow } from './PlaylistTrackRow';
import type { PlaylistTrack } from './PlaylistTrackRow';
import type { QueueAction, QueueItem, PreviewTrack, SearchState } from '../App';

interface SearchResponse {
  results: SearchResult[];
  used_fallback: boolean;
}

interface PlaylistTrackEvent {
  type: 'Track' | 'Done' | 'Error';
  data?: {
    id?: string;
    title?: string;
    thumbnail_url?: string;
    duration?: string;
    channel?: string;
    total?: number;
    message?: string;
  };
}

interface SearchTabProps {
  dispatch: React.Dispatch<QueueAction>;
  queue: QueueItem[];
  onPreview: (track: PreviewTrack) => void;
  onNavigateSettings: () => void;
  onNavigateQueue?: () => void;
  downloadedIds?: Set<string>;
  searchState: SearchState;
  onSearchStateChange: (s: SearchState) => void;
}

function isYoutubeUrl(input: string): boolean {
  return (
    input.startsWith('https://www.youtube.com/') ||
    input.startsWith('https://youtube.com/') ||
    input.startsWith('http://www.youtube.com/') ||
    input.startsWith('http://youtube.com/') ||
    input.startsWith('www.youtube.com/') ||
    input.startsWith('youtube.com/') ||
    input.startsWith('https://youtu.be/') ||
    input.startsWith('http://youtu.be/') ||
    input.startsWith('youtu.be/')
  );
}

function stripRadioParams(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('start_radio');
    parsed.searchParams.delete('list');
    // list=PL... (일반 플레이리스트)는 지우면 안 되지만,
    // 이 함수는 isYoutubeUrl() && !isPlaylistUrl() 분기에서만 호출되므로 안전.
    return parsed.toString();
  } catch {
    return url;
  }
}

function isPlaylistUrl(url: string): boolean {
  // /playlist?list= format only (standard curated playlists)
  // Radio Mix (list=RD...) is intentionally excluded — treated as single video
  return url.includes('/playlist?list=') || (url.includes('/playlist?') && url.includes('list='));
}

export function SearchTab({
  dispatch,
  queue,
  onPreview,
  onNavigateSettings,
  onNavigateQueue,
  downloadedIds,
  searchState,
  onSearchStateChange,
}: SearchTabProps) {
  const { query, results, isSearching, hasSearched, usedFallback, isPlaylist, playlistTracks, selectedIds, playlistLoading } = searchState;

  const [toast, setToast] = useState<string | null>(null);
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Keep a ref to latest searchState for use inside async callbacks
  const searchStateRef = useRef(searchState);
  useEffect(() => {
    searchStateRef.current = searchState;
  }, [searchState]);

  const update = (patch: Partial<SearchState>) =>
    onSearchStateChange({ ...searchState, ...patch });

  const handleSearch = async () => {
    if (!query.trim()) return;

    const trimmed = query.trim();

    // Playlist URL branch
    if (isPlaylistUrl(trimmed)) {
      onSearchStateChange({
        ...searchState,
        isPlaylist: true,
        playlistLoading: true,
        playlistTracks: [],
        selectedIds: new Set(),
        results: [],
        hasSearched: true,
      });

      const onTrack = new Channel<PlaylistTrackEvent>();
      onTrack.onmessage = (event) => {
        if (event.type === 'Track' && event.data) {
          const track: PlaylistTrack = {
            id: event.data.id ?? '',
            title: event.data.title ?? '',
            thumbnail_url: event.data.thumbnail_url ?? '',
            duration: event.data.duration ?? '?',
            channel: event.data.channel ?? '',
          };
          onSearchStateChange({
            ...searchStateRef.current,
            playlistTracks: [...searchStateRef.current.playlistTracks, track],
          });
        } else if (event.type === 'Done') {
          onSearchStateChange({ ...searchStateRef.current, playlistLoading: false });
        } else if (event.type === 'Error') {
          onSearchStateChange({ ...searchStateRef.current, playlistLoading: false });
        }
      };

      await invoke('search_playlist', { url: trimmed, onTrack });
      return;
    }

    // YouTube single video URL branch — skip search, add directly to queue
    if (isYoutubeUrl(trimmed) && !isPlaylistUrl(trimmed)) {
      const cleanUrl = stripRadioParams(trimmed);
      const videoId = (() => {
        try {
          const parsed = new URL(cleanUrl);
          if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
          return parsed.searchParams.get('v') ?? '';
        } catch {
          return '';
        }
      })();

      if (!videoId) {
        showToast('~ URL에서 영상 ID를 찾을 수 없어요 ~');
        return;
      }

      if (queue.some((item) => item.id === videoId)) {
        showToast('~ 이미 큐에 있어요 ~');
        return;
      }

      setIsAddingUrl(true);
      // 이전 검색 결과 지우기
      update({ results: [], hasSearched: false, isPlaylist: false });

      try {
        const store = await load('app-settings.json', { defaults: {} });
        const apiKey = await store.get<string | null>('youtube_api_key');

        const response = await invoke<SearchResponse>('search', {
          query: cleanUrl,
          apiKey: apiKey || null,
        });

        const track = response.results[0];
        if (!track) {
          showToast('~ 영상 정보를 가져올 수 없어요 ~');
          return;
        }

        dispatch({
          type: 'ADD_ITEM',
          item: {
            id: track.id,
            title: track.title,
            channelName: track.channel,
            thumbnailUrl: track.thumbnail_url,
            duration: track.duration,
          },
        });

        showToast(`~ 큐에 추가했어요: ${track.title} ~`);
        onNavigateQueue?.();
      } catch (err) {
        console.error('URL fetch failed:', err);
        showToast('~ 영상 정보를 가져오는 데 실패했어요 ~');
      } finally {
        setIsAddingUrl(false);
      }
      return;
    }

    // Normal search
    update({ isPlaylist: false, isSearching: true, hasSearched: true });

    try {
      const store = await load('app-settings.json', { defaults: {} });
      const apiKey = await store.get<string | null>('youtube_api_key');

      const response = await invoke<SearchResponse>('search', {
        query: trimmed,
        apiKey: apiKey || null,
      });

      onSearchStateChange({
        ...searchStateRef.current,
        results: response.results,
        usedFallback: response.used_fallback,
        isSearching: false,
      });
    } catch (err) {
      console.error('Search failed:', err);
      onSearchStateChange({ ...searchStateRef.current, results: [], isSearching: false });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleToggleTrack = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    update({ selectedIds: next });
  };

  const handleSelectAll = () => {
    update({ selectedIds: new Set(playlistTracks.map((t) => t.id)) });
  };

  const handleDeselectAll = () => {
    update({ selectedIds: new Set() });
  };

  const handleAddSelectedToQueue = () => {
    playlistTracks
      .filter((t) => selectedIds.has(t.id))
      .forEach((t) => {
        dispatch({
          type: 'ADD_ITEM',
          item: {
            id: t.id,
            title: t.title,
            channelName: t.channel,
            thumbnailUrl: t.thumbnail_url,
            duration: t.duration,
          },
        });
      });
  };

  const handleBackToSearch = () => {
    update({ isPlaylist: false, playlistTracks: [], selectedIds: new Set(), playlistLoading: false });
  };

  const queueIds = new Set(queue.map((item) => item.id));

  return (
    <div>
      {toast && (
        <div
          style={{
            background: 'var(--color-pink)',
            border: 'var(--border-style)',
            padding: '8px 16px',
            marginBottom: '12px',
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            color: 'var(--color-blue-dark)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Search input row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="type a song or artist name..."
          value={query}
          onChange={(e) => update({ query: e.target.value })}
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || isAddingUrl || playlistLoading || !query.trim()}
          style={{ flexShrink: 0 }}
        >
          {isYoutubeUrl(query.trim()) && !isPlaylistUrl(query.trim()) ? 'ADD TO QUEUE' : 'SEARCH'}
        </button>
      </div>

      {/* Playlist view */}
      {isPlaylist && (
        <div>
          {/* Playlist toolbar */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={handleBackToSearch}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '9px',
                background: 'var(--color-white)',
                border: 'var(--border-style)',
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              &lt; BACK
            </button>
            <button
              type="button"
              onClick={handleSelectAll}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '9px',
                background: 'var(--color-pink)',
                border: 'var(--border-style)',
                padding: '6px 10px',
                cursor: 'pointer',
                boxShadow: '2px 2px 0px var(--color-pink-dark)',
              }}
            >
              SELECT ALL
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '9px',
                background: 'var(--color-white)',
                border: 'var(--border-style)',
                padding: '6px 10px',
                cursor: 'pointer',
                boxShadow: '2px 2px 0px var(--color-pink-dark)',
              }}
            >
              DESELECT ALL
            </button>
            <button
              type="button"
              onClick={handleAddSelectedToQueue}
              disabled={selectedIds.size === 0}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '9px',
                background: selectedIds.size > 0 ? 'var(--color-pink-dark)' : 'var(--color-pink)',
                color: selectedIds.size > 0 ? 'white' : 'var(--color-black)',
                border: 'var(--border-style)',
                padding: '6px 10px',
                cursor: selectedIds.size > 0 ? 'pointer' : 'default',
                boxShadow: '2px 2px 0px var(--color-pink-dark)',
                opacity: selectedIds.size === 0 ? 0.5 : 1,
              }}
            >
              ADD TO QUEUE ({selectedIds.size})
            </button>
            {playlistLoading && (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '18px',
                  color: 'var(--color-pink-dark)',
                }}
              >
                ~ loading tracks...
              </span>
            )}
          </div>

          {/* Playlist tracks */}
          <div>
            {playlistTracks.map((track) => (
              <PlaylistTrackRow
                key={track.id}
                track={track}
                checked={selectedIds.has(track.id)}
                onToggle={handleToggleTrack}
                isDownloaded={downloadedIds?.has(track.id) ?? false}
              />
            ))}

            {/* Skeleton loading rows while streaming */}
            {playlistLoading && (
              <>
                <style>{`
                  @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                  }
                `}</style>
                {[1, 2, 3].map((i) => (
                  <div
                    key={`skeleton-${i}`}
                    style={{
                      height: '52px',
                      marginBottom: '1px',
                      background:
                        'linear-gradient(90deg, var(--color-pink) 25%, var(--color-white) 50%, var(--color-pink) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />
                ))}
              </>
            )}

            {!playlistLoading && playlistTracks.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: '32px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '12px',
                    color: 'var(--color-pink-dark)',
                  }}
                >
                  ~ no tracks found ~
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Normal search view */}
      {!isPlaylist && (
        <div>
          {/* Fallback warning banner */}
          {hasSearched && usedFallback && results.length > 0 && (
            <div
              onClick={onNavigateSettings}
              style={{
                cursor: 'pointer',
                background: 'rgba(183, 223, 255, 0.4)',
                border: 'var(--border-style)',
                padding: '8px 16px',
                marginBottom: '16px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '20px',
                  color: 'var(--color-blue-dark)',
                }}
              >
                ~ using yt-dlp fallback (no API key) ~
              </span>
            </div>
          )}

          {/* Content area */}
          {!hasSearched && (
            <div style={{ textAlign: 'center', paddingTop: '32px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  color: 'var(--color-pink-dark)',
                  marginBottom: '12px',
                }}
              >
                ~ search for tunes ~
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '18px',
                  color: 'var(--color-blue-dark)',
                }}
              >
                type a song or artist name above
              </div>
            </div>
          )}

          {isSearching && (
            <div style={{ textAlign: 'center', paddingTop: '32px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  color: 'var(--color-pink-dark)',
                }}
              >
                ~ searching... ~
              </div>
            </div>
          )}

          {hasSearched && !isSearching && results.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: '32px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  color: 'var(--color-pink-dark)',
                  marginBottom: '12px',
                }}
              >
                ~ no results found ~
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '18px',
                  color: 'var(--color-blue-dark)',
                }}
              >
                try a different keyword or paste a URL
              </div>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <div>
              {results.map((result) => (
                <SearchResultRow
                  key={result.id}
                  result={result}
                  isInQueue={queueIds.has(result.id)}
                  isDownloaded={downloadedIds?.has(result.id) ?? false}
                  onPreview={() =>
                    onPreview({
                      id: result.id,
                      title: result.title,
                      audioUrl: `https://www.youtube.com/watch?v=${result.id}`,
                    })
                  }
                  onAddToQueue={() =>
                    dispatch({
                      type: 'ADD_ITEM',
                      item: {
                        id: result.id,
                        title: result.title,
                        channelName: result.channel,
                        thumbnailUrl: result.thumbnail_url,
                        duration: result.duration,
                      },
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
