import { useState, useReducer } from 'react';
import './styles/theme.css';
import './styles/global.css';
import { TabBar } from './components/TabBar';
import { SearchTab } from './components/SearchTab';
import { QueueTab } from './components/QueueTab';
import { SettingsTab } from './components/SettingsTab';
import { PlayerBar } from './components/PlayerBar';

type Tab = 'search' | 'queue' | 'settings';

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
}

export type QueueAction =
  | { type: 'ADD_ITEM'; item: Omit<QueueItem, 'status'> }
  | { type: 'UPDATE_STATUS'; id: string; status: QueueItemStatus }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'CLEAR_DONE' };

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

  const queueBadgeCount = queue.length;

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
          />
        )}
        {activeTab === 'queue' && (
          <QueueTab
            queue={queue}
            dispatch={dispatch}
            onNavigateSettings={() => setActiveTab('settings')}
          />
        )}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      <PlayerBar track={previewTrack} onStop={() => setPreviewTrack(null)} />
    </div>
  );
}

export default App;
