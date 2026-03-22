import { useState, useReducer, useEffect } from 'react';
import './styles/theme.css';
import './styles/global.css';
import { TabBar } from './components/TabBar';
import { SearchTab } from './components/SearchTab';
import { QueueTab } from './components/QueueTab';
import { SettingsTab } from './components/SettingsTab';
import { PlayerBar } from './components/PlayerBar';
import { HistoryTab } from './components/HistoryTab';
import { useAutoUpdate } from './hooks/useAutoUpdate';

type Tab = 'search' | 'queue' | 'history' | 'settings';

// Queue types — shared across components
export type QueueItemStatus =
  | { type: 'pending' }
  | { type: 'downloading'; percent: number; speed: string }
  | { type: 'converting' }
  | { type: 'done'; path: string }
  | { type: 'error'; message: string }
  | { type: 'retrying'; attempt: number; waitSecs: number; remainingSecs: number };

export interface QueueItem {
  id: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: string;
  status: QueueItemStatus;
  metadataOverrides?: {
    title?: string;
    artist?: string;
    album?: string;
  };
}

export type QueueAction =
  | { type: 'ADD_ITEM'; item: Omit<QueueItem, 'status'> }
  | { type: 'UPDATE_STATUS'; id: string; status: QueueItemStatus }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'CLEAR_DONE' }
  | { type: 'SET_METADATA'; id: string; overrides: { title?: string; artist?: string; album?: string } };

export interface HistoryEntry {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  downloadedAt: string; // ISO 8601
  filePath: string;
}

function queueReducer(state: QueueItem[], action: QueueAction): QueueItem[] {
  switch (action.type) {
    case 'ADD_ITEM':
      if (state.some((i) => i.id === action.item.id)) return state;
      return [...state, { ...action.item, status: { type: 'pending' } }];
    case 'UPDATE_STATUS':
      return state.map((i) =>
        i.id === action.id ? { ...i, status: action.status } : i
      );
    case 'REMOVE_ITEM':
      return state.filter((i) => i.id !== action.id);
    case 'CLEAR_DONE':
      return state.filter((i) => i.status.type !== 'done');
    case 'SET_METADATA':
      return state.map((i) =>
        i.id === action.id ? { ...i, metadataOverrides: action.overrides } : i
      );
    default:
      return state;
  }
}

export interface PreviewTrack {
  id: string;
  title: string;
  audioUrl: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [queue, dispatch] = useReducer(queueReducer, []);
  const [previewTrack, setPreviewTrack] = useState<PreviewTrack | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  const { updateAvailable, version, install, dismiss } = useAutoUpdate();

  const queueBadgeCount = queue.length;

  // Load history on mount to populate downloadedIds for DOWNLOADED badge
  useEffect(() => {
    (async () => {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load('download-history.json', { defaults: {} });
      const entries = await store.get<HistoryEntry[]>('entries');
      if (entries) {
        setDownloadedIds(new Set(entries.map((e) => e.videoId)));
      }
    })();
  }, []);

  const refreshDownloadedIds = async () => {
    const { load } = await import('@tauri-apps/plugin-store');
    const store = await load('download-history.json', { defaults: {} });
    const entries = await store.get<HistoryEntry[]>('entries');
    if (entries) {
      setDownloadedIds(new Set(entries.map((e) => e.videoId)));
    }
  };

  return (
    <div
      className="app-container"
      style={{
        maxWidth: '700px',
        margin: '0 auto',
        padding: '24px',
        boxShadow: '8px 8px 0px var(--color-pink-dark)',
        border: 'var(--border-style)',
        minHeight: '100vh',
        boxSizing: 'border-box',
        paddingBottom: '72px',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            color: 'var(--color-pink-dark)',
            margin: '0 0 8px 0',
            lineHeight: '1.6',
          }}
        >
          YouTube Music Downloader
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            color: 'var(--color-blue-dark)',
            margin: 0,
          }}
        >
          ~ retro vibes only ~
        </p>
      </header>

      <TabBar active={activeTab} onSwitch={setActiveTab} queueBadge={queueBadgeCount} />

      <main
        style={{
          border: 'var(--border-style)',
          padding: '24px',
          background: 'rgba(255, 183, 213, 0.1)',
          boxShadow: 'inset 2px 2px 0px var(--color-pink)',
        }}
      >
        {activeTab === 'search' && (
          <SearchTab
            dispatch={dispatch}
            queue={queue}
            onPreview={setPreviewTrack}
            onNavigateSettings={() => setActiveTab('settings')}
            downloadedIds={downloadedIds}
          />
        )}
        {activeTab === 'queue' && (
          <QueueTab
            queue={queue}
            dispatch={dispatch}
            onNavigateSettings={() => setActiveTab('settings')}
            onHistoryUpdate={refreshDownloadedIds}
          />
        )}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      <PlayerBar track={previewTrack} onStop={() => setPreviewTrack(null)} />

      {updateAvailable && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            background: 'var(--color-green)',
            border: 'var(--border-style)',
            boxShadow: '4px 4px 0px var(--color-pink-dark)',
            padding: '12px 16px',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            zIndex: 1000,
            maxWidth: '300px',
          }}
        >
          <div style={{ marginBottom: '8px', color: 'var(--color-blue-dark)' }}>
            Update available — v{version}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => install?.()}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                padding: '4px 12px',
                background: 'var(--color-pink)',
                border: 'var(--border-style)',
                cursor: 'pointer',
              }}
            >
              Update Now
            </button>
            <button
              onClick={dismiss}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                padding: '4px 12px',
                background: 'var(--color-blue)',
                border: 'var(--border-style)',
                cursor: 'pointer',
              }}
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
