type Tab = 'search' | 'queue' | 'history' | 'settings';

interface TabBarProps {
  active: Tab;
  onSwitch: (tab: Tab) => void;
  queueBadge: number;
}

export function TabBar({ active, onSwitch, queueBadge }: TabBarProps) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'search', label: 'SEARCH' },
    { id: 'queue', label: 'QUEUE' },
    { id: 'history', label: 'HISTORY' },
    { id: 'settings', label: 'SETTINGS' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        height: '44px',
        marginBottom: '0',
        borderBottom: '3px solid var(--color-pink-dark)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSwitch(tab.id)}
            style={{
              flex: 1,
              height: '44px',
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              border: 'none',
              borderBottom: isActive
                ? '3px solid var(--color-pink-dark)'
                : '3px solid transparent',
              background: isActive ? 'var(--color-pink)' : 'var(--color-white)',
              color: isActive ? 'var(--color-black)' : 'var(--color-black)',
              boxShadow: 'none',
              transition: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '0 8px',
            }}
          >
            {tab.label}
            {tab.id === 'queue' && queueBadge > 0 && (
              <span
                style={{
                  background: 'var(--color-blue)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  color: 'white',
                  padding: '2px 6px',
                  marginLeft: '4px',
                }}
              >
                ({queueBadge})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
