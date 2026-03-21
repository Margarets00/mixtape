import { useState } from 'react';

export interface SearchResult {
  id: string;
  title: string;
  thumbnail_url: string;
  duration: string;
  channel: string;
}

interface SearchResultRowProps {
  result: SearchResult;
  isInQueue: boolean;
  onPreview: () => void;
  onAddToQueue: () => void;
}

export function SearchResultRow({
  result,
  isInQueue,
  onPreview,
  onAddToQueue,
}: SearchResultRowProps) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: '1px solid var(--color-pink)',
        background: hovered ? 'rgba(255, 183, 213, 0.4)' : 'transparent',
        cursor: 'default',
      }}
    >
      {/* Thumbnail */}
      {imgError ? (
        <div
          style={{
            width: '48px',
            height: '48px',
            flexShrink: 0,
            background: 'var(--color-pink)',
            border: 'var(--border-style)',
          }}
        />
      ) : (
        <img
          src={result.thumbnail_url}
          alt={result.title}
          width={48}
          height={48}
          onError={() => setImgError(true)}
          style={{
            width: '48px',
            height: '48px',
            flexShrink: 0,
            border: 'var(--border-style)',
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
          {result.title}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '18px',
              color: 'var(--color-blue-dark)',
            }}
          >
            {result.channel}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '18px',
              color: 'var(--color-black)',
            }}
          >
            {' \u00B7 '}{result.duration}
          </span>
        </div>
        {isInQueue && (
          <span
            style={{
              background: 'var(--color-blue)',
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              textTransform: 'uppercase',
              padding: '2px 6px',
              display: 'inline-block',
              marginTop: '4px',
              color: 'white',
            }}
          >
            IN QUEUE
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={onPreview}
          style={{
            background: 'var(--color-pink-dark)',
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            color: 'white',
            padding: '6px 10px',
            border: 'none',
            boxShadow: '2px 2px 0px var(--color-pink-dark)',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          {'\u25B6'} PREVIEW
        </button>
        <button
          type="button"
          onClick={onAddToQueue}
          style={{
            background: 'var(--color-pink)',
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            padding: '6px 10px',
            border: 'var(--border-style)',
            boxShadow: '2px 2px 0px var(--color-pink-dark)',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          + QUEUE
        </button>
      </div>
    </div>
  );
}
