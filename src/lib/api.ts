const API_BASE = import.meta.env.VITE_MEDUSA_BACKEND_URL || 'http://localhost:9000'
const ADMIN_API_KEY = import.meta.env.VITE_MEDUSA_API_KEY || ''

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options

  let url = `${API_BASE}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value))
    })
    url += `?${searchParams.toString()}`
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }

  if (ADMIN_API_KEY) {
    headers['Authorization'] = `Bearer ${ADMIN_API_KEY}`
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `API Error: ${response.status}`)
  }

  return response.json()
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
    apiFetch<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),

  delete: <T>(endpoint: string) =>
    apiFetch<T>(endpoint, { method: 'DELETE' }),
}

export default api
