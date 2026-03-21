interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      style={{
        background: 'var(--color-yellow)',
        border: '3px solid #FF6B6B',
        padding: '12px 16px',
        marginTop: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}
    >
      <span
        style={{
          flex: 1,
          fontFamily: 'var(--font-body)',
          fontSize: '18px',
          color: 'var(--color-black)',
          wordBreak: 'break-word',
        }}
      >
        {message}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: '#FF6B6B',
          border: '2px solid #D44',
          boxShadow: '2px 2px 0px #D44',
          padding: '2px 8px',
          fontSize: '14px',
          flexShrink: 0,
          lineHeight: '1',
        }}
        aria-label="Dismiss error"
      >
        X
      </button>
    </div>
  );
}
