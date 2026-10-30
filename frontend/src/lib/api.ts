// HTTP API (GET /getsessions, GET /getchathistory) at VITE_API_URL.

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export interface SessionSummary {
  session_id: string
  'session name': string
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`)
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<T>
}

export const fetchSessions = () => get<SessionSummary[]>('/getsessions')

export const fetchChatHistory = (sessionId: string) =>
  get<HistoryMessage[]>(`/getchathistory?sessionID=${encodeURIComponent(sessionId)}`)
  