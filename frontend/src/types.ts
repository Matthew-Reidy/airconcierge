export type Role = 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  pending?: boolean
}

export interface Session {
  id: string
  title: string
  updatedAt: number
  messages: Message[]
}
