import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';

export function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedConfirm, setSavedConfirm] = useState(false);
  const [saveDir, setSaveDir] = useState('');

  useEffect(() => {
    (async () => {
      const store = await load('app-settings.json', { defaults: {} });
      const key = await store.get<string | null>('youtube_api_key');
      if (key) setApiKey(key);
      const dir = await store.get<string | null>('lastSaveDir');
      if (dir) setSaveDir(dir);
    })();
  }, []);

  const handleSaveApiKey = async () => {
    const store = await load('app-settings.json', { defaults: {} });
    await store.set('youtube_api_key', apiKey);
    await store.save();
    setSavedConfirm(true);
    setTimeout(() => setSavedConfirm(false), 2000);
  };

  const handlePickFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      setSaveDir(selected);
      const store = await load('app-settings.json', { defaults: {} });
      await store.set('lastSaveDir', selected);
      await store.save();
    }
  };

  const displayPath = saveDir
    ? saveDir.length > 40
      ? '...' + saveDir.slice(-37)
      : saveDir
    : 'No folder selected';

  return (
    <div>
      {/* API Key section */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            marginBottom: '8px',
            color: 'var(--color-black)',
          }}
        >
          YOUTUBE API KEY
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..."
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            style={{
              flexShrink: 0,
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              padding: '6px 10px',
              whiteSpace: 'nowrap',
            }}
          >
            {showKey ? '[HIDE]' : '[SHOW]'}
          </button>
        </div>
        <button
          type="button"
          onClick={handleSaveApiKey}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            color: savedConfirm ? 'var(--color-green-dark)' : undefined,
          }}
        >
          {savedConfirm ? 'KEY SAVED \u2713' : 'SAVE API KEY'}
        </button>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            color: 'var(--color-black)',
            opacity: 0.6,
            marginTop: '8px',
          }}
        >
          ~ stored locally in plain text ~
        </div>
      </div>

      {/* Folder picker section */}
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            marginBottom: '8px',
            color: 'var(--color-black)',
          }}
        >
          SAVE TO:
        </div>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '18px',
            color: saveDir ? 'var(--color-black)' : '#888',
            marginBottom: '8px',
          }}
        >
          {displayPath}
        </div>
        <button
          type="button"
          onClick={handlePickFolder}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
          }}
        >
          PICK FOLDER
        </button>
      </div>
    </div>
  );
}
