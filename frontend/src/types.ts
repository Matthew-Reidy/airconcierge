export type Role = 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  pending?: boolean
}

export interface Session {
  /** local identifier; equals remoteId for sessions loaded from the backend */
  id: string
  /** backend session id. Unset until the first message of a new session is sent. */
  remoteId?: string
  title: string
  /** 0 when unknown (sessions listed by the backend carry no timestamp) */
  updatedAt: number
  messages: Message[]
  /** false for sessions listed by the backend whose history has not been fetched yet */
  loaded?: boolean
}
