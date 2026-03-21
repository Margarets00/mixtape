import { useEffect, useState } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import type { QueueAction, QueueItem } from '../App';
import { QueueItemRow } from './QueueItem';

interface DownloadEvent {
  type: 'Progress' | 'Postprocessing' | 'Done' | 'Error' | 'RetryWait';
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
}

export function QueueTab({ queue, dispatch, onNavigateSettings }: QueueTabProps) {
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

    onEvent.onmessage = (event: DownloadEvent) => {
      switch (event.type) {
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
        case 'Done':
          dispatch({
            type: 'UPDATE_STATUS',
            id: item.id,
            status: { type: 'done', path: event.data?.path ?? '' },
          });
          break;
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
          />
        ))}
      </div>
    </div>
  );
}
