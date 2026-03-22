// Auto-update disabled — no code signing configured
export function useAutoUpdate() {
  return {
    updateAvailable: false,
    version: null,
    install: null,
    dismiss: () => {},
  };
}
