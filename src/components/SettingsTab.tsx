import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';

function previewFilename(pattern: string): string {
  if (!pattern.trim()) return 'Bohemian Rhapsody.mp3';
  return (
    pattern
      .replace('{title}', 'Bohemian Rhapsody')
      .replace('{artist}', 'Queen')
      .replace('{channel}', 'Queen Official')
      .replace('{year}', '1975')
      .replace('{track_num}', '03') + '.mp3'
  );
}

export function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedConfirm, setSavedConfirm] = useState(false);
  const [saveDir, setSaveDir] = useState('');
  const [filenamePattern, setFilenamePattern] = useState('');
  const [embedThumbnail, setEmbedThumbnail] = useState(true);

  useEffect(() => {
    (async () => {
      const store = await load('app-settings.json', { defaults: {} });
      const key = await store.get<string | null>('youtube_api_key');
      if (key) setApiKey(key);
      const dir = await store.get<string | null>('lastSaveDir');
      if (dir) setSaveDir(dir);
      const pattern = await store.get<string | null>('filename_pattern');
      if (pattern) setFilenamePattern(pattern);
      const thumb = await store.get<boolean | null>('embed_thumbnail');
      if (thumb !== null && thumb !== undefined) setEmbedThumbnail(thumb);
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

  const handleSavePattern = async () => {
    const store = await load('app-settings.json', { defaults: {} });
    await store.set('filename_pattern', filenamePattern);
    await store.save();
  };

  const handleToggleThumbnail = async (checked: boolean) => {
    setEmbedThumbnail(checked);
    const store = await load('app-settings.json', { defaults: {} });
    await store.set('embed_thumbnail', checked);
    await store.save();
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
      <div style={{ marginBottom: '32px' }}>
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

      {/* Filename Pattern section */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            marginBottom: '8px',
            color: 'var(--color-black)',
          }}
        >
          FILENAME PATTERN
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            value={filenamePattern}
            onChange={(e) => setFilenamePattern(e.target.value)}
            placeholder="{artist} - {title}"
            style={{ flex: 1 }}
          />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-blue-dark)',
            marginBottom: '4px',
          }}
        >
          Available: {'{title}'}, {'{artist}'}, {'{channel}'}, {'{year}'}, {'{track_num}'}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-pink-dark)',
            fontStyle: 'italic',
            marginBottom: '8px',
          }}
        >
          Preview: {previewFilename(filenamePattern)}
        </div>
        <button
          type="button"
          onClick={handleSavePattern}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
          }}
        >
          SAVE PATTERN
        </button>
      </div>

      {/* Thumbnail Embed section */}
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            marginBottom: '8px',
            color: 'var(--color-black)',
          }}
        >
          EMBED THUMBNAIL
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <input
            type="checkbox"
            checked={embedThumbnail}
            onChange={(e) => handleToggleThumbnail(e.target.checked)}
            id="embed-thumbnail-toggle"
          />
          <label
            htmlFor="embed-thumbnail-toggle"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-blue-dark)',
            }}
          >
            Embed YouTube thumbnail as album art in MP3
          </label>
        </div>
      </div>
    </div>
  );
}
