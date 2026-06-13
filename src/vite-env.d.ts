/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_ONESIGNAL_APP_ID?: string
  readonly VITE_TELEGRAM_BOT_ENABLED: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
