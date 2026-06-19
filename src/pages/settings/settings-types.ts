export interface NavLink {
  label: string
  url: string
}

export interface CookieConsent {
  enabled: boolean
  title: string
  message: string
  acceptLabel: string
  declineLabel: string
}

export interface Announcement {
  enabled: boolean
  message: string
  backgroundColor: string
  textColor: string
}

export interface StoreDetails {
  storeName: string
  email: string
  phone: string
  address: string
}

export interface SettingsResponse {
  settings: Array<{
    id: string
    key: string
    value: any
  }>
}
