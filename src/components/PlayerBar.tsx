import type { PreviewTrack } from '../App';

interface PlayerBarProps {
  track: PreviewTrack | null;
  onStop: () => void;
}

export function PlayerBar({ track, onStop }: PlayerBarProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '48px',
        background: track ? 'rgba(183, 223, 255, 0.8)' : 'var(--color-pink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
        fontSize: '18px',
        color: 'var(--color-pink-dark)',
        opacity: track ? 1 : 0.5,
        gap: '12px',
      }}
    >
      {track ? (
        <>
          <span
            style={{
              color: 'var(--color-blue-dark)',
              fontFamily: 'var(--font-body)',
              fontSize: '20px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '60%',
            }}
          >
            {track.title}
          </span>
          <button
            type="button"
            onClick={onStop}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              padding: '4px 8px',
              flexShrink: 0,
            }}
          >
            STOP
          </button>
        </>
      ) : (
        '~ no track playing ~'
      )}
    </div>
  );
}
