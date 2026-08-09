// ============================================================
// Storage seam for mobile — Capacitor SecureStorage (Keychain/Keystore)
// Falls back to localStorage when running in browser dev mode.
// ============================================================

type TokenPersistence = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

let _persistence: TokenPersistence = {
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => localStorage.setItem(key, value),
  removeItem: async (key) => localStorage.removeItem(key),
}

export async function setTokenPersistence(p: TokenPersistence) {
  _persistence = p
}

export async function getAccessToken(): Promise<string | null> {
  return _persistence.getItem('access_token')
}

export async function setAccessToken(token: string): Promise<void> {
  return _persistence.setItem('access_token', token)
}

export async function clearAccessToken(): Promise<void> {
  return _persistence.removeItem('access_token')
}

export async function getRefreshToken(): Promise<string | null> {
  return _persistence.getItem('refresh_token')
}

export async function setRefreshToken(token: string): Promise<void> {
  return _persistence.setItem('refresh_token', token)
}

export async function clearTokens(): Promise<void> {
  await _persistence.removeItem('access_token')
  await _persistence.removeItem('refresh_token')
}
