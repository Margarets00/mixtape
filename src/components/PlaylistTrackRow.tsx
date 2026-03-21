import { useState } from 'react';

export interface PlaylistTrack {
  id: string;
  title: string;
  thumbnail_url: string;
  duration: string;
  channel: string;
}

interface PlaylistTrackRowProps {
  track: PlaylistTrack;
  checked: boolean;
  onToggle: (id: string) => void;
  isDownloaded?: boolean;
}

export function PlaylistTrackRow({ track, checked, onToggle, isDownloaded }: PlaylistTrackRowProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: '1px solid var(--color-pink)',
        background: checked ? 'rgba(255, 183, 213, 0.2)' : 'transparent',
        cursor: 'pointer',
      }}
      onClick={() => onToggle(track.id)}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(track.id)}
        onClick={(e) => e.stopPropagation()}
        style={{ flexShrink: 0, cursor: 'pointer', width: '16px', height: '16px' }}
      />

      {/* Thumbnail */}
      {imgError ? (
        <div
          style={{
            width: '40px',
            height: '30px',
            flexShrink: 0,
            background: 'var(--color-pink)',
            border: 'var(--border-style)',
          }}
        />
      ) : (
        <img
          src={track.thumbnail_url}
          alt={track.title}
          width={40}
          height={30}
          onError={() => setImgError(true)}
          style={{
            width: '40px',
            height: '30px',
            flexShrink: 0,
            border: '2px solid var(--color-pink-dark)',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Track info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '20px',
            color: 'var(--color-black)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {track.title}
          {isDownloaded && (
            <span
              style={{
                background: 'var(--color-pink)',
                fontFamily: 'var(--font-display)',
                fontSize: '8px',
                padding: '2px 4px',
                marginLeft: '6px',
                display: 'inline-block',
                verticalAlign: 'middle',
                color: 'var(--color-black)',
              }}
            >
              DOWNLOADED
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            color: 'var(--color-blue-dark)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {track.channel}
        </div>
      </div>

      {/* Duration */}
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '18px',
          color: 'var(--color-black)',
          flexShrink: 0,
        }}
      >
        {track.duration}
      </div>
    </div>
  );
}
