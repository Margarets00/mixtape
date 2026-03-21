import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface VersionInfo {
  current: string;
  latest: string;
  update_available: boolean;
}

export function UpdateButton() {
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleCheck = async () => {
    setChecking(true);
    setVersionInfo(null);
    setUpdateResult(null);
    setUpdateError(null);
    try {
      const info = await invoke<VersionInfo>('check_ytdlp_version');
      setVersionInfo(info);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = async () => {
    if (!versionInfo) return;
    setUpdating(true);
    setUpdateResult(null);
    setUpdateError(null);
    try {
      const newVersion = await invoke<string>('update_ytdlp');
      setUpdateResult(`Updated to ${newVersion}!`);
      setVersionInfo((prev) =>
        prev ? { ...prev, current: newVersion, update_available: false } : null
      );
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <button
        type="button"
        onClick={handleCheck}
        disabled={checking || updating}
        style={{
          background: 'var(--color-blue)',
          fontSize: '10px',
          padding: '8px 16px',
        }}
      >
        {checking ? 'Checking...' : 'Check yt-dlp Update'}
      </button>

      {versionInfo && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            textAlign: 'center',
            color: 'var(--color-black)',
          }}
        >
          <span>
            Current: {versionInfo.current} | Latest: {versionInfo.latest}
          </span>
          {versionInfo.update_available && (
            <div style={{ marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={updating}
                style={{
                  background: 'var(--color-green)',
                  fontSize: '10px',
                  padding: '8px 16px',
                }}
              >
                {updating ? 'Updating...' : `Update to ${versionInfo.latest}?`}
              </button>
            </div>
          )}
          {!versionInfo.update_available && (
            <div style={{ color: 'var(--color-green-dark)', marginTop: '4px' }}>
              Up to date!
            </div>
          )}
        </div>
      )}

      {updateResult && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: 'var(--color-green-dark)',
          }}
        >
          {updateResult}
        </div>
      )}

      {updateError && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: '#FF6B6B',
          }}
        >
          Error: {updateError}
        </div>
      )}
    </div>
  );
}
