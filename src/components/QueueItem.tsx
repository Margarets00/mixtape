import { invoke } from '@tauri-apps/api/core';
import type { QueueItem } from '../App';

interface QueueItemProps {
  item: QueueItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export function QueueItemRow({ item, onCancel, onRetry }: QueueItemProps) {
  const status = item.status;

  const getBackground = () => {
    switch (status.type) {
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

  const handleCancel = async () => {
    await invoke('cancel_download', { itemId: item.id }).catch(console.error);
    onCancel(item.id);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        position: 'relative',
        borderBottom: '1px solid var(--color-pink)',
        minHeight: '64px',
        background: getBackground(),
        overflow: 'hidden',
      }}
    >
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
                {item.title}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '18px',
                  color: 'var(--color-blue-dark)',
                }}
              >
                {item.channelName}
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
              CONVERTING...
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
        {(status.type === 'pending' || status.type === 'downloading' || status.type === 'retrying') && (
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
  );
}
