// ============================================================
// Capability gates — platform feature detection
// UI components use these instead of checking Electron directly.
// ============================================================

/** True when running outside Electron (web browser or Capacitor). */
export function isWebRuntime(): boolean {
  return (window as any).__WEB__ === true
}

/** True when running inside Electron desktop shell. */
export function isElectron(): boolean {
  return !isWebRuntime()
}

/** True when running in Electron desktop (has local file system for model config storage). */
export function isElectronDesktop(): boolean {
  return isElectron()
}

/** Local file system access (Electron fsApi). */
export function hasLocalFiles(): boolean {
  return !isWebRuntime() && !!(window as any).electronAPI?.cwd
}

/** Native save dialogs (Electron). */
export function hasNativeSave(): boolean {
  return hasLocalFiles()
}

/** Terminal / shell access (node-pty in Electron). */
export function hasTerminalRun(): boolean {
  return isElectron()
}

/** Auto-updater (Electron). */
export function hasAutoUpdater(): boolean {
  return isElectron()
}

/** Desktop IPC for Electron-specific channels. */
export function hasDesktopIPC(): boolean {
  return isElectron()
}

/** Local Python sidecar engine. */
export function hasLocalEngine(): boolean {
  return isElectron()
}

/** Secure storage (iOS Keychain / Android Keystore). Not available in Electron. */
export function hasSecureStorage(): boolean {
  return false // Not implemented yet; will be true in Capacitor shell
}
