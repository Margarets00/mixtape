import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { QueueItem } from '../App';

interface QueueItemProps {
  item: QueueItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onSetMetadata: (id: string, overrides: { title?: string; artist?: string; album?: string }) => void;
}

export function QueueItemRow({ item, onCancel, onRetry, onSetMetadata }: QueueItemProps) {
  const status = item.status;
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const [editTitle, setEditTitle] = useState(item.metadataOverrides?.title || item.title);
  const [editArtist, setEditArtist] = useState(item.metadataOverrides?.artist || '');
  const [editAlbum, setEditAlbum] = useState(item.metadataOverrides?.album || '');

  const getBackground = () => {
    switch (status.type) {
      case 'starting':
        return 'rgba(183, 213, 255, 0.2)';
      case 'downloading':
        return 'rgba(255, 183, 213, 0.3)';
      case 'converting':
        return 'rgba(255, 183, 213, 0.3)';
      case 'done':
        return 'rgba(183, 255, 216, 0.3)';
      case 'error':
        return 'rgba(255, 245, 183, 0.3)';
      case 'retrying':
        return 'rgba(183, 213, 255, 0.3)';
      default:
        return 'var(--color-white)';
    }
  };

  const [elapsedSecs, setElapsedSecs] = useState(0);

  useEffect(() => {
    if (status.type !== 'converting') {
      setElapsedSecs(0);
      return;
    }
    setElapsedSecs(0);
    const interval = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [status.type]);

  const handleCancel = async () => {
    await invoke('cancel_download', { itemId: item.id }).catch(console.error);
    onCancel(item.id);
  };

  return (
    <div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 16px',
          position: 'relative',
          borderBottom: metadataExpanded && status.type === 'pending' ? 'none' : '1px solid var(--color-pink)',
          minHeight: '64px',
          background: getBackground(),
          overflow: 'hidden',
        }}
      >
        {/* Shimmer fill for starting state */}
        {status.type === 'starting' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, rgba(183, 213, 255, 0.2) 25%, rgba(183, 213, 255, 0.4) 50%, rgba(183, 213, 255, 0.2) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              zIndex: 0,
            }}
          />
        )}

        {/* Inline progress bar fill for downloading state */}
        {status.type === 'downloading' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${status.percent}%`,
              height: '100%',
              background: 'rgba(255, 105, 180, 0.4)',
              zIndex: 0,
            }}
          />
        )}

        {/* Full-width fill for converting state */}
        {status.type === 'converting' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(255, 105, 180, 0.4)',
              zIndex: 0,
            }}
          />
        )}

        {/* Content overlay */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, position: 'relative', zIndex: 1, gap: '8px' }}>
          {/* Thumbnail */}
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            width={48}
            height={48}
            style={{
              width: '48px',
              height: '48px',
              objectFit: 'cover',
              border: 'var(--border-style)',
              flexShrink: 0,
            }}
          />

          {/* Text content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {status.type === 'pending' && (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '20px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.metadataOverrides?.title || item.title}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '18px',
                    color: 'var(--color-blue-dark)',
                  }}
                >
                  {item.channelName}
                  {item.metadataOverrides?.artist && (
                    <span style={{ color: 'var(--color-pink-dark)', marginLeft: '4px' }}>
                      · {item.metadataOverrides.artist}
                    </span>
                  )}
                </div>
              </>
            )}

            {status.type === 'starting' && (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '20px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.metadataOverrides?.title || item.title}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '10px',
                    color: 'var(--color-blue-dark)',
                    background: 'linear-gradient(90deg, var(--color-blue) 25%, var(--color-white) 50%, var(--color-blue) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    display: 'inline-block',
                  }}
                >
                  starting...
                </div>
              </>
            )}

            {status.type === 'downloading' && (
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '18px',
                }}
              >
                {Math.round(status.percent)}% · {status.speed}
              </div>
            )}

            {status.type === 'converting' && (
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '18px',
                  animation: 'blink 1s infinite',
                }}
              >
                {`CONVERTING... (${elapsedSecs}s)`}
              </div>
            )}

            {status.type === 'retrying' && (
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '18px',
                  color: 'var(--color-pink-dark)',
                }}
              >
                {`Retrying in ${status.remainingSecs}s... (attempt ${status.attempt}/3)`}
              </div>
            )}

            {status.type === 'done' && (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '20px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    opacity: 0.6,
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '10px',
                    color: 'var(--color-green-dark)',
                  }}
                >
                  DONE ✓
                </div>
              </>
            )}

            {status.type === 'error' && (
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '18px',
                  color: 'var(--color-black)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {status.message}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
            {status.type === 'pending' && (
              <button
                type="button"
                onClick={() => setMetadataExpanded(!metadataExpanded)}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  background: 'var(--color-pink)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                {metadataExpanded ? 'Close' : 'Edit'}
              </button>
            )}

            {(status.type === 'pending' || status.type === 'starting' || status.type === 'downloading' || status.type === 'retrying') && (
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  background: 'rgba(45, 27, 27, 0.1)',
                  border: '1px solid var(--color-black)',
                  boxShadow: 'none',
                  color: 'var(--color-black)',
                  flexShrink: 0,
                  padding: '4px 8px',
                }}
              >
                ✕ CANCEL
              </button>
            )}

            {status.type === 'done' && (
              <button
                type="button"
                onClick={async () => {
                  const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
                  try {
                    await revealItemInDir(status.path);
                  } catch (e) {
                    console.error('revealItemInDir failed:', e);
                  }
                }}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  background: 'var(--color-blue)',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                Show in Finder
              </button>
            )}

            {status.type === 'error' && (
              <button
                type="button"
                onClick={() => onRetry(item.id)}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  background: 'var(--color-pink-dark)',
                  color: 'white',
                  border: 'none',
                  boxShadow: 'none',
                  flexShrink: 0,
                  padding: '4px 8px',
                }}
              >
                RETRY
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline metadata editor — only shown when pending and expanded */}
      {metadataExpanded && status.type === 'pending' && (
        <div style={{
          padding: '8px 8px 8px 56px',
          borderBottom: '1px solid var(--color-pink)',
          background: 'rgba(183, 213, 255, 0.1)',
        }}>
          <label style={{ fontFamily: 'var(--font-display)', fontSize: '9px', display: 'block', marginBottom: '4px' }}>Title</label>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            style={{
              width: '100%',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              padding: '4px',
              border: '1px solid var(--color-pink)',
              marginBottom: '6px',
              boxSizing: 'border-box',
            }}
          />
          <label style={{ fontFamily: 'var(--font-display)', fontSize: '9px', display: 'block', marginBottom: '4px' }}>Artist</label>
          <input
            value={editArtist}
            onChange={(e) => setEditArtist(e.target.value)}
            style={{
              width: '100%',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              padding: '4px',
              border: '1px solid var(--color-pink)',
              marginBottom: '6px',
              boxSizing: 'border-box',
            }}
          />
          <label style={{ fontFamily: 'var(--font-display)', fontSize: '9px', display: 'block', marginBottom: '4px' }}>Album</label>
          <input
            value={editAlbum}
            onChange={(e) => setEditAlbum(e.target.value)}
            style={{
              width: '100%',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              padding: '4px',
              border: '1px solid var(--color-pink)',
              marginBottom: '6px',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => {
              onSetMetadata(item.id, {
                title: editTitle || undefined,
                artist: editArtist || undefined,
                album: editAlbum || undefined,
              });
              setMetadataExpanded(false);
            }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              background: 'var(--color-green)',
              border: 'none',
              padding: '4px 12px',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
