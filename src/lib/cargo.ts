/**
 * Kargo (carrier) takip URL üretimi — admin tarafı.
 * Backend src/lib/cargo.ts ve storefront src/lib/util/cargo.ts ile aynı mantık.
 */

interface CarrierDef {
  name: string
  trackingUrlTemplate: string
}

const CARRIERS: Record<string, CarrierDef> = {
  aras: {
    name: 'Aras Kargo',
    trackingUrlTemplate:
      'https://kargotakip.araskargo.com.tr/?gonderitakipno={code}',
  },
  yurtici: {
    name: 'Yurtiçi Kargo',
    trackingUrlTemplate:
      'https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code={code}',
  },
  mng: {
    name: 'MNG Kargo',
    trackingUrlTemplate:
      'https://service.mngkargo.com.tr/iframe/iframe.aspx?KODNO={code}',
  },
  ptt: {
    name: 'PTT Kargo',
    trackingUrlTemplate: 'https://gonderitakip.ptt.gov.tr/Track/Verify?q={code}',
  },
}

const DEFAULT_CARRIER = 'aras'

export function resolveCarrier(providerId?: string | null): CarrierDef {
  if (providerId) {
    const prefix = providerId.split('_')[0]
    if (prefix && CARRIERS[prefix]) return CARRIERS[prefix]
  }
  return CARRIERS[DEFAULT_CARRIER]
}

export function getCarrierName(providerId?: string | null): string {
  return resolveCarrier(providerId).name
}

export function getTrackingUrl(
  trackingNumber: string,
  providerId?: string | null
): string | null {
  const code = (trackingNumber || '').trim()
  if (!code) return null
  const carrier = resolveCarrier(providerId)
  if (!carrier.trackingUrlTemplate) return null
  return carrier.trackingUrlTemplate.replace('{code}', encodeURIComponent(code))
}
