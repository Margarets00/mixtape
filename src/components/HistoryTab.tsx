import { useState, useEffect } from 'react';
import { load } from '@tauri-apps/plugin-store';
import type { HistoryEntry } from '../App';

export function HistoryTab() {
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
        </div>
      ))}
    </div>
  );
}
