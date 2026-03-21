import { useState } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import { FolderPicker } from './FolderPicker';
import { ProgressBar } from './ProgressBar';
import { ErrorBanner } from './ErrorBanner';

type DownloadStatus = 'idle' | 'downloading' | 'postprocessing' | 'done' | 'error';

type DownloadEvent =
  | { type: 'Progress'; data: { percent: number; speed: string; eta: string } }
  | { type: 'Postprocessing'; data: null }
  | { type: 'Done'; data: { path: string } }
  | { type: 'Error'; data: { message: string } };

export function DownloadForm() {
  const [url, setUrl] = useState('');
  const [saveDir, setSaveDir] = useState('');
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [percent, setPercent] = useState(0);
  const [speed, setSpeed] = useState('');
  const [eta, setEta] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isDownloading = status === 'downloading' || status === 'postprocessing';
  const canDownload = url.trim().length > 0 && saveDir.length > 0 && !isDownloading;

  const handleDownload = async () => {
    if (!canDownload) return;

    // Reset state
    setStatus('downloading');
    setPercent(0);
    setSpeed('');
    setEta('');
    setError(null);

    try {
      const onEvent = new Channel<DownloadEvent>();
      onEvent.onmessage = (event) => {
        switch (event.type) {
          case 'Progress':
            setPercent(event.data.percent);
            setSpeed(event.data.speed);
            setEta(event.data.eta);
            setStatus('downloading');
            break;
          case 'Postprocessing':
            setStatus('postprocessing');
            break;
          case 'Done':
            setStatus('done');
            setPercent(100);
            break;
          case 'Error':
            setStatus('error');
            setError(event.data.message);
            break;
        }
      };

      await invoke('download', { url: url.trim(), saveDir, onEvent });
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="url-input"
          style={{
            display: 'block',
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            marginBottom: '8px',
            color: 'var(--color-pink-dark)',
          }}
        >
          YouTube URL
        </label>
        <input
          id="url-input"
          type="text"
          placeholder="Paste YouTube URL here..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isDownloading}
          onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
        />
      </div>

      <div style={{ marginBottom: '4px' }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            marginBottom: '8px',
            color: 'var(--color-pink-dark)',
          }}
        >
          Save Folder
        </label>
        <FolderPicker onFolderChange={setSaveDir} />
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={!canDownload}
        style={{ width: '100%', fontSize: '14px', padding: '14px' }}
      >
        {isDownloading ? 'Downloading...' : 'Download MP3'}
      </button>

      <ProgressBar percent={percent} speed={speed} eta={eta} status={status} />
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
