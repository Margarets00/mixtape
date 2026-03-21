import type { QueueAction, QueueItem } from '../App';

interface QueueTabProps {
  queue: QueueItem[];
  dispatch: React.Dispatch<QueueAction>;
  onNavigateSettings: () => void;
}

export function QueueTab({ queue, dispatch }: QueueTabProps) {
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
      {queue.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderBottom: '1px solid var(--color-pink)',
          }}
        >
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            width={48}
            height={48}
            style={{ width: '48px', height: '48px', objectFit: 'cover', border: 'var(--border-style)', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.title}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '18px', color: 'var(--color-blue-dark)' }}>
              {item.channelName}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_ITEM', id: item.id })}
            style={{ fontFamily: 'var(--font-display)', fontSize: '10px', flexShrink: 0 }}
          >
            REMOVE
          </button>
        </div>
      ))}
    </div>
  );
}
