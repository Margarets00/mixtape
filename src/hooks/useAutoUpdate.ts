import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

interface UpdateInfo {
  version: string;
  install: () => Promise<void>;
}

export function useAutoUpdate() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    check()
      .then((update) => {
        if (update?.available) {
          setUpdateInfo({
            version: update.version,
            install: async () => {
              await update.downloadAndInstall();
              await relaunch();
            },
          });
        }
      })
      .catch(() => {
        // Silent failure — never block app launch
      });
  }, []);

  const dismiss = () => setDismissed(true);

  return {
    updateAvailable: updateInfo !== null && !dismissed,
    version: updateInfo?.version ?? null,
    install: updateInfo?.install ?? null,
    dismiss,
  };
}
