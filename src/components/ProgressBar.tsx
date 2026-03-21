interface ProgressBarProps {
  percent: number;
  speed: string;
  eta: string;
  status: 'idle' | 'downloading' | 'postprocessing' | 'done' | 'error';
}

export function ProgressBar({ percent, speed, eta, status }: ProgressBarProps) {
  if (status === 'idle') {
    return null;
  }

  const statusText = {
    downloading: 'Downloading...',
    postprocessing: 'Converting to MP3...',
    done: 'Done!',
    error: '',
    idle: '',
  }[status];

  const fillColor =
    status === 'done'
      ? 'var(--color-green)'
      : status === 'error'
      ? '#FF6B6B'
      : undefined;

  return (
    <div style={{ marginTop: '16px' }}>
      <div
        style={{
          border: 'var(--border-style)',
          height: '24px',
          background: 'var(--color-white)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, percent))}%`,
            height: '100%',
            background: fillColor ?? 'linear-gradient(90deg, var(--color-pink), var(--color-blue))',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '18px',
          marginTop: '6px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontWeight: 'bold', color: status === 'done' ? 'var(--color-green-dark)' : 'inherit' }}>
          {statusText}
        </span>
        {status === 'downloading' && (
          <span>
            {speed && <span>{speed}</span>}
            {eta && <span style={{ marginLeft: '12px' }}>ETA: {eta}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
