import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';

interface FolderPickerProps {
  onFolderChange: (path: string) => void;
}

export function FolderPicker({ onFolderChange }: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState<string>('');

  useEffect(() => {
    // Restore last saved path on mount
    (async () => {
      const store = await load('app-settings.json', { defaults: {} });
      const savedPath = await store.get<string>('lastSaveDir');
      if (savedPath) {
        setCurrentPath(savedPath);
        onFolderChange(savedPath);
      }
    })();
  }, []);

  const handleChooseFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      setCurrentPath(selected);
      onFolderChange(selected);

      // Persist to store
      const store = await load('app-settings.json', { defaults: {} });
      await store.set('lastSaveDir', selected);
    }
  };

  const displayPath = currentPath
    ? currentPath.length > 40
      ? '...' + currentPath.slice(-37)
      : currentPath
    : 'No folder selected';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
      <span
        style={{
          flex: 1,
          fontFamily: 'var(--font-body)',
          fontSize: '18px',
          padding: '10px',
          border: 'var(--border-style)',
          background: 'var(--color-blue)',
          color: currentPath ? 'var(--color-black)' : '#888',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayPath}
      </span>
      <button
        type="button"
        onClick={handleChooseFolder}
        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        Choose Folder
      </button>
    </div>
  );
}
