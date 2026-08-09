import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bspbuddy.mobile',
  appName: 'BspBuddy',
  webDir: '../../out/mobile',
  server: {
    // Production: replace with your backend URL
    // url: 'https://api.bspbuddy.com',
    // cleartext: false,
  },
  plugins: {
    SecureStorage: {
      // iOS Keychain / Android Keystore for auth tokens
    },
  },
}

export default config
