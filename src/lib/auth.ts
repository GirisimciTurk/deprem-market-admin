// Admin authentication against the Medusa Admin API.
// We authenticate with /auth/user/emailpass to obtain a JWT, store it, and send
// it as a Bearer token on every /admin request.

const TOKEN_KEY = 'dm_admin_token'

export const API_BASE =
  import.meta.env.VITE_MEDUSA_BACKEND_URL || 'http://localhost:9000'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

/**
 * Log in with admin email/password. Returns the JWT on success or throws with a
 * user-friendly Turkish message.
 */
export async function login(email: string, password: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/auth/user/emailpass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error('Sunucuya bağlanılamadı. Backend çalışıyor mu?')
  }

  if (res.status === 401) {
    throw new Error('E-posta veya şifre hatalı.')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.message || `Giriş başarısız (HTTP ${res.status}).`)
  }

  const data = (await res.json()) as { token?: string }
  if (!data.token) {
    throw new Error('Sunucudan geçerli bir oturum alınamadı.')
  }
  setToken(data.token)
  return data.token
}

export function logout(): void {
  clearToken()
  // Hard redirect so all in-memory state and query cache are dropped.
  window.location.href = '/login'
}

/**
 * Request a password-reset email for an admin account. Always resolves without
 * revealing whether the account exists (prevents user enumeration).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/user/emailpass/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email }),
    })
  } catch {
    throw new Error('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.')
  }
}

/**
 * Set a new password using the reset token from the email link.
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/auth/user/emailpass/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password }),
    })
  } catch {
    throw new Error('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.')
  }

  if (res.status === 401) {
    throw new Error('Bağlantının süresi dolmuş veya geçersiz. Lütfen yeni bir sıfırlama bağlantısı isteyin.')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.message || `Şifre güncellenemedi (HTTP ${res.status}).`)
  }
}
