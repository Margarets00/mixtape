import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
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

interface Props {
  deps: DepsResult;
  onReady: () => void;
}

export function SetupScreen({ deps, onReady }: Props) {
  const [ytdlpDep, setYtdlpDep] = useState<DepStatus>(deps.ytdlp);
  const [ffmpegDep, setFfmpegDep] = useState<DepStatus>(deps.ffmpeg);
  const [checking, setChecking] = useState(false);
  const [pickingKey, setPickingKey] = useState<'ytdlp' | 'ffmpeg' | null>(null);

  const recheck = async () => {
    setChecking(true);
    try {
      const result = await invoke<DepsResult>('check_deps');
      setYtdlpDep(result.ytdlp);
      setFfmpegDep(result.ffmpeg);
      if (result.ytdlp.found && result.ffmpeg.found) {
        onReady();
      }
    } finally {
      setChecking(false);
    }
  };

  const pickPath = async (key: 'ytdlp' | 'ffmpeg') => {
    setPickingKey(key);
    try {
      const selected = await open({ multiple: false, directory: false });
      if (selected && typeof selected === 'string') {
        await invoke('set_dep_path', { key, path: selected });
        await recheck();
      }
    } finally {
      setPickingKey(null);
    }
  };

  const allReady = ytdlpDep.found && ffmpegDep.found;

  const DepRow = ({
    label,
    dep,
    depKey,
    installUrl,
    installHint,
  }: {
    label: string;
    dep: DepStatus;
    depKey: 'ytdlp' | 'ffmpeg';
    installUrl: string;
    installHint: string;
  }) => (
    <div
      style={{
        border: 'var(--border-style)',
        padding: '16px',
        marginBottom: '16px',
        background: dep.found ? 'rgba(119, 221, 119, 0.15)' : 'rgba(255, 105, 180, 0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            color: 'var(--color-black)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: dep.found ? 'var(--color-green-dark)' : 'var(--color-pink-dark)',
          }}
        >
          {dep.found ? `✓ found` : '✗ not found'}
        </span>
      </div>
      {dep.found && dep.path && (
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            color: 'var(--color-black)',
            opacity: 0.6,
            marginBottom: '4px',
            wordBreak: 'break-all',
          }}
        >
          {dep.path}
        </div>
      )}
      {dep.found && dep.version && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-blue-dark)',
            marginBottom: '8px',
          }}
        >
          {dep.version}
        </div>
      )}
      {!dep.found && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-black)',
            opacity: 0.7,
            marginBottom: '10px',
          }}
        >
          {installHint}
          <br />
          <a
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-pink-dark)', fontFamily: 'var(--font-display)', fontSize: '10px' }}
          >
            {installUrl}
          </a>
        </div>
      )}
      <button
        type="button"
        onClick={() => pickPath(depKey)}
        disabled={pickingKey !== null}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '10px',
          padding: '4px 12px',
        }}
      >
        {pickingKey === depKey ? 'PICKING...' : 'SET PATH MANUALLY'}
      </button>
    </div>
  );

  return (
    <div
      style={{
        maxWidth: '700px',
        margin: '0 auto',
        padding: '24px',
        boxShadow: '8px 8px 0px var(--color-pink-dark)',
        border: 'var(--border-style)',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            color: 'var(--color-pink-dark)',
            margin: '0 0 8px 0',
          }}
        >
          mixtape
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            color: 'var(--color-blue-dark)',
            margin: '0 0 16px 0',
          }}
        >
          First-time setup
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-black)',
            opacity: 0.7,
            margin: 0,
          }}
        >
          mixtape needs yt-dlp and ffmpeg to download music.
          <br />
          Install them or point to existing binaries below.
        </p>
      </header>

      <div
        style={{
          border: 'var(--border-style)',
          padding: '24px',
          background: 'rgba(255, 183, 213, 0.1)',
          boxShadow: 'inset 2px 2px 0px var(--color-pink)',
        }}
      >
        <DepRow
          label="YT-DLP"
          dep={ytdlpDep}
          depKey="ytdlp"
          installUrl="https://github.com/yt-dlp/yt-dlp#installation"
          installHint="Install via: brew install yt-dlp  |  pip install yt-dlp  |  winget install yt-dlp"
        />
        <DepRow
          label="FFMPEG"
          dep={ffmpegDep}
          depKey="ffmpeg"
          installUrl="https://ffmpeg.org/download.html"
          installHint="Install via: brew install ffmpeg  |  winget install ffmpeg"
        />

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={recheck}
            disabled={checking}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              padding: '6px 16px',
              background: 'var(--color-blue)',
              border: 'var(--border-style)',
            }}
          >
            {checking ? 'CHECKING...' : 'RE-CHECK'}
          </button>
          {allReady && (
            <button
              type="button"
              onClick={onReady}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '10px',
                padding: '6px 16px',
                background: 'var(--color-green)',
                border: 'var(--border-style)',
              }}
            >
              CONTINUE →
            </button>
          )}
        </div>
        {allReady && (
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-green-dark)',
              marginTop: '12px',
            }}
          >
            ✓ All dependencies found — ready to go!
          </div>
        )}
      </div>
    </div>
  );
}
