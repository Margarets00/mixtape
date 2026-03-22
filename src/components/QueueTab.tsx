import { useEffect, useState } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import type { QueueAction, QueueItem, HistoryEntry } from '../App';
import { QueueItemRow } from './QueueItem';

interface DownloadEvent {
  type: 'Starting' | 'Progress' | 'Postprocessing' | 'Done' | 'Error' | 'RetryWait';
  data?: {
    percent?: number;
    speed?: string;
    eta?: string;
    path?: string;
    message?: string;
    attempt?: number;
    wait_secs?: number;
    remaining_secs?: number;
  };
}

interface QueueTabProps {
  queue: QueueItem[];
  dispatch: React.Dispatch<QueueAction>;
  onNavigateSettings: () => void;
  onHistoryUpdate?: () => void;
}

async function addToHistory(item: QueueItem, filePath: string) {
  const store = await load('download-history.json', { defaults: {} });
  const entries: HistoryEntry[] = (await store.get<HistoryEntry[]>('entries')) || [];

  const newEntry: HistoryEntry = {
    videoId: item.id,
    title: item.title,
    channelName: item.channelName,
    thumbnailUrl: item.thumbnailUrl,
    downloadedAt: new Date().toISOString(),
    filePath: filePath,
  };

  // Prepend new entry, cap at 500 entries (per RESEARCH recommendation)
  const updated = [newEntry, ...entries.filter((e) => e.videoId !== item.id)].slice(0, 500);
  await store.set('entries', updated);
  await store.save();
}

async function notifyDownloadComplete(title: string) {
  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === 'granted';
    }
    if (granted) {
      sendNotification({ title: 'Download Complete', body: title });
    }
  } catch (e) {
    console.error('Notification failed:', e);
  }
}

export function QueueTab({ queue, dispatch, onNavigateSettings, onHistoryUpdate }: QueueTabProps) {
  const [saveDir, setSaveDir] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    load('app-settings.json', { defaults: {} })
      .then((store) => store.get<string>('lastSaveDir'))
      .then((dir) => {
        if (dir) setSaveDir(dir);
      })
      .catch(console.error);
  }, []);

  const pendingOrErrorItems = queue.filter(
    (item) => item.status.type === 'pending' || item.status.type === 'error'
  );
  const hasDoneItems = queue.some((item) => item.status.type === 'done');
  const isDownloadAllDisabled = isDownloading || pendingOrErrorItems.length === 0;

  const downloadItem = async (item: QueueItem) => {
    const videoUrl = `https://www.youtube.com/watch?v=${item.id}`;
    const onEvent = new Channel<DownloadEvent>();
    const settingsStore = await load('app-settings.json', { defaults: {} });
    const filenamePattern = await settingsStore.get<string | null>('filename_pattern');
    const embedThumbnail = await settingsStore.get<boolean | null>('embed_thumbnail');

    // Snapshot item data before channel callback (avoid stale closure capture)
    const itemData = { ...item };
    const itemTitle = item.title;

    onEvent.onmessage = (event: DownloadEvent) => {
      switch (event.type) {
        case 'Starting':
          dispatch({
            type: 'UPDATE_STATUS',
            id: item.id,
            status: { type: 'starting' },
          });
          break;
        case 'Progress':
          dispatch({
            type: 'UPDATE_STATUS',
            id: item.id,
            status: {
              type: 'downloading',
              percent: event.data?.percent ?? 0,
              speed: event.data?.speed ?? '',
            },
          });
          break;
        case 'Postprocessing':
          dispatch({
            type: 'UPDATE_STATUS',
            id: item.id,
            status: { type: 'converting' },
          });
          break;
        case 'Done': {
          const filePath = event.data?.path ?? '';
          dispatch({
            type: 'UPDATE_STATUS',
            id: item.id,
            status: { type: 'done', path: filePath },
          });

          // Write to history (HIST-01, D-16)
          addToHistory(itemData, filePath).catch(console.error);

          // System notification (QOL-02, D-18)
          notifyDownloadComplete(itemTitle).catch(console.error);

          // Notify parent to refresh downloadedIds for DOWNLOADED badge
          onHistoryUpdate?.();
          break;
        }
        case 'Error':
          dispatch({
            type: 'UPDATE_STATUS',
            id: item.id,
            status: { type: 'error', message: event.data?.message ?? 'Unknown error' },
          });
          break;
        case 'RetryWait':
          dispatch({
            type: 'UPDATE_STATUS',
            id: item.id,
            status: {
              type: 'retrying',
              attempt: event.data?.attempt ?? 1,
              waitSecs: event.data?.wait_secs ?? 30,
              remainingSecs: event.data?.remaining_secs ?? 30,
            },
          });
          break;
      }
    };

    await invoke('queue_download', {
      itemId: item.id,
      videoUrl,
      saveDir,
      filenamePattern: filenamePattern || null,
      embedThumbnail: embedThumbnail !== null ? embedThumbnail : true,
      metadataOverrides: item.metadataOverrides || null,
      onEvent,
    });
  };

  const handleDownloadAll = async () => {
    if (isDownloadAllDisabled || !saveDir) return;
    setIsDownloading(true);

    // Reset error items to pending before downloading
    for (const item of pendingOrErrorItems) {
      if (item.status.type === 'error') {
        dispatch({ type: 'UPDATE_STATUS', id: item.id, status: { type: 'pending' } });
      }
    }

    try {
      // Fire all downloads — semaphore in Rust limits concurrency to 2
      await Promise.allSettled(pendingOrErrorItems.map(downloadItem));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRetry = (id: string) => {
    const item = queue.find((i) => i.id === id);
    if (!item || !saveDir) return;
    dispatch({ type: 'UPDATE_STATUS', id, status: { type: 'pending' } });
    downloadItem({ ...item, status: { type: 'pending' } }).catch(console.error);
  };

  const handleCancel = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', id });
  };

  if (queue.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '32px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            color: 'var(--color-pink-dark)',
            marginBottom: '12px',
          }}
        >
          ~ nothing in the queue ~
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            color: 'var(--color-blue-dark)',
          }}
        >
          search for tracks and hit [+ QUEUE]
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          SAVING TO: {saveDir || (
            <span style={{ color: 'var(--color-blue-dark)' }}>No folder selected</span>
          )}
        </div>
        <button
          type="button"
          onClick={onNavigateSettings}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            flexShrink: 0,
          }}
        >
          CHANGE
        </button>
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={isDownloadAllDisabled}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            background: 'var(--color-pink-dark)',
            color: 'white',
            flexShrink: 0,
          }}
        >
          DOWNLOAD ALL
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'CLEAR_DONE' })}
          disabled={!hasDoneItems}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            background: 'var(--color-pink)',
            flexShrink: 0,
          }}
        >
          CLEAR DONE
        </button>
      </div>

      {/* Queue item list */}
      <div>
        {queue.map((item) => (
          <QueueItemRow
            key={item.id}
            item={item}
            onCancel={handleCancel}
            onRetry={handleRetry}
            onSetMetadata={(id, overrides) => dispatch({ type: 'SET_METADATA', id, overrides })}
          />
        ))}
      </div>
    </div>
  );
}
