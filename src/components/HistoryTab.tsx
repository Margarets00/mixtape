import { useState, useEffect } from 'react';
import { load } from '@tauri-apps/plugin-store';
import type { HistoryEntry, QueueItem, QueueAction } from '../App';

interface HistoryTabProps {
  dispatch: React.Dispatch<QueueAction>;
  queue: QueueItem[];
}

export function HistoryTab({ dispatch, queue }: HistoryTabProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    (async () => {
      const store = await load('download-history.json', { defaults: {} });
      const saved = await store.get<HistoryEntry[]>('entries');
      if (saved) {
        // Show most recent first
        setEntries([...saved].reverse());
      }
    })();
  }, []);

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--font-body)', color: 'var(--color-blue-dark)' }}>
        No download history yet
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--color-pink-dark)', marginBottom: '12px' }}>
        Download History ({entries.length})
      </h3>
      {entries.map((entry) => (
        <div key={entry.videoId + entry.downloadedAt} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px', borderBottom: '1px solid var(--color-pink)',
          fontFamily: 'var(--font-body)', fontSize: '12px',
        }}>
          <img src={entry.thumbnailUrl} alt="" width={40} height={30}
            style={{ objectFit: 'cover', border: '1px solid var(--color-pink)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.title}
            </div>
            <div style={{ color: 'var(--color-blue-dark)', fontSize: '10px' }}>
              {entry.channelName} | {new Date(entry.downloadedAt).toLocaleDateString()}
            </div>
          </div>
          <button
            disabled={queue.some((i) => i.id === entry.videoId && i.status.type !== 'done')}
            onClick={() => dispatch({ type: 'ADD_ITEM', item: { id: entry.videoId, title: entry.title, channelName: entry.channelName, thumbnailUrl: entry.thumbnailUrl, duration: '' } })}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              padding: '2px 8px',
              background: 'var(--color-green)',
              border: 'var(--border-style)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              ...(queue.some((i) => i.id === entry.videoId && i.status.type !== 'done') ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
            }}
          >
            + QUEUE
          </button>
        </div>
      ))}
    </div>
  );
}
