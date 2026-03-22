// Auto-update disabled — no code signing configured
export function useAutoUpdate(): {
  updateAvailable: boolean;
  version: string | null;
  install: (() => void) | null;
  dismiss: () => void;
} {
  return {
    updateAvailable: false,
    version: null,
    install: null,
    dismiss: () => {},
  };
}
