/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEDUSA_BACKEND_URL: string
  readonly VITE_MEDUSA_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
