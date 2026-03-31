import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';

interface DepStatus {
  found: boolean;
  path: string | null;
  version: string | null;
}

interface DepsResult {
  ytdlp: DepStatus;
  ffmpeg: DepStatus;
}

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
  const [cookieBrowser, setCookieBrowser] = useState<string | null>(null);
  const [cookieStatus, setCookieStatus] = useState<'unknown' | 'ok' | 'none'>('unknown');
  const [deps, setDeps] = useState<DepsResult | null>(null);
  const [pickingDep, setPickingDep] = useState<'ytdlp' | 'ffmpeg' | null>(null);

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
      const savedBrowser = await store.get<string | null>('cookie_browser');
      if (savedBrowser) {
        setCookieBrowser(savedBrowser);
        setCookieStatus('ok');
      } else {
        setCookieStatus('none');
      }
      // Load dep status
      try {
        const result = await invoke<DepsResult>('check_deps');
        setDeps(result);
      } catch {
        // command not available in full bundled build — ignore
      }
    })();
  }, []);

  const handlePickDepPath = async (key: 'ytdlp' | 'ffmpeg') => {
    setPickingDep(key);
    try {
      const selected = await open({ multiple: false, directory: false });
      if (selected && typeof selected === 'string') {
        await invoke('set_dep_path', { key, path: selected });
        const result = await invoke<DepsResult>('check_deps');
        setDeps(result);
      }
    } finally {
      setPickingDep(null);
    }
  };

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

  const handleSelectBrowser = async (browser: string | null) => {
    setCookieBrowser(browser);
    setCookieStatus(browser ? 'ok' : 'none');
    await invoke('set_cookie_browser', { browser });
    const store = await load('app-settings.json', { defaults: {} });
    await store.set('cookie_browser', browser);
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
      <div style={{ marginBottom: '32px' }}>
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

      {/* Cookie Browser section */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '10px', marginBottom: '8px', color: 'var(--color-black)' }}>
          COOKIE SOURCE
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: cookieStatus === 'ok' ? 'var(--color-green-dark)' : 'var(--color-pink-dark)', marginBottom: '8px' }}>
          {cookieStatus === 'ok' && cookieBrowser
            ? `쿠키 사용 중: ${cookieBrowser}`
            : '쿠키 미사용 (Sign in 에러 발생 시 브라우저 선택)'}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['chrome', 'safari', 'firefox', 'brave', 'edge'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => handleSelectBrowser(cookieBrowser === b ? null : b)}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '10px',
                background: cookieBrowser === b ? 'var(--color-pink)' : undefined,
                border: 'var(--border-style)',
                padding: '4px 10px',
              }}
            >
              {cookieBrowser === b ? `[${b.toUpperCase()}] \u2713` : b.toUpperCase()}
            </button>
          ))}
          {cookieBrowser && (
            <button
              type="button"
              onClick={() => handleSelectBrowser(null)}
              style={{ fontFamily: 'var(--font-display)', fontSize: '10px', padding: '4px 10px' }}
            >
              [OFF]
            </button>
          )}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-black)', opacity: 0.5, marginTop: '6px' }}>
          ~ 해당 브라우저로 YouTube에 로그인된 상태여야 합니다 ~
        </div>
      </div>

      {/* Dependencies section */}
      {deps && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '10px', marginBottom: '12px', color: 'var(--color-black)' }}>
            DEPENDENCIES
          </div>
          {(['ytdlp', 'ffmpeg'] as const).map((key) => {
            const dep = deps[key];
            return (
              <div
                key={key}
                style={{
                  border: 'var(--border-style)',
                  padding: '12px',
                  marginBottom: '8px',
                  background: dep.found ? 'rgba(119, 221, 119, 0.1)' : 'rgba(255, 105, 180, 0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--color-black)' }}>
                    {key === 'ytdlp' ? 'YT-DLP' : 'FFMPEG'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: dep.found ? 'var(--color-green-dark)' : 'var(--color-pink-dark)' }}>
                    {dep.found ? '✓' : '✗ not found'}
                  </span>
                </div>
                {dep.version && (
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-blue-dark)', marginBottom: '4px' }}>
                    {dep.version}
                  </div>
                )}
                {dep.path && (
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-black)', opacity: 0.55, marginBottom: '8px', wordBreak: 'break-all' }}>
                    {dep.path}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handlePickDepPath(key)}
                  disabled={pickingDep !== null}
                  style={{ fontFamily: 'var(--font-display)', fontSize: '10px', padding: '4px 10px' }}
                >
                  {pickingDep === key ? 'PICKING...' : 'CHANGE PATH'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
