import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { SearchResultRow } from './SearchResultRow';
import type { SearchResult } from './SearchResultRow';
import type { QueueAction, QueueItem, PreviewTrack } from '../App';

interface SearchResponse {
  results: SearchResult[];
  used_fallback: boolean;
}

interface SearchTabProps {
  dispatch: React.Dispatch<QueueAction>;
  queue: QueueItem[];
  onPreview: (track: PreviewTrack) => void;
  onNavigateSettings: () => void;
}

export function SearchTab({ dispatch, queue, onPreview, onNavigateSettings }: SearchTabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Load api key from store to pass to Rust command
      const store = await load('app-settings.json', { defaults: {} });
      const apiKey = await store.get<string | null>('youtube_api_key');

      const response = await invoke<SearchResponse>('search', {
        query: query.trim(),
        apiKey: apiKey || null,
      });

      setResults(response.results);
      setUsedFallback(response.used_fallback);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const queueIds = new Set(queue.map((item) => item.id));

  return (
    <div>
      {/* Search input row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="type a song or artist name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          style={{ flexShrink: 0 }}
        >
          SEARCH
        </button>
      </div>

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
  );
}
