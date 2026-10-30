import type { Session } from '../types'

interface Props {
  sessions: Session[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function relativeTime(timestamp: number) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const Chatsidebar = ({ sessions, activeId, onSelect, onNew, onDelete }: Props) => {
  const sorted = [...sessions].sort((sessionA, sessionB) => sessionB.updatedAt - sessionA.updatedAt)
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">✈ Travel Agent</div>
      <button className="new-chat" onClick={onNew}>+ New trip</button>
      <div className="sidebar-label">Past sessions</div>
      <ul className="session-list">
        {sorted.map((session) => {
          const lastMessage = session.messages[session.messages.length - 1]
          return (
            <li key={session.id}>
              <button
                className={'session' + (session.id === activeId ? ' active' : '')}
                onClick={() => onSelect(session.id)}
              >
                <span className="session-title">{session.title}</span>
                <span className="session-preview">
                  {lastMessage ? lastMessage.content.slice(0, 60) : session.loaded === false ? 'Click to load' : 'No messages yet'}
                </span>
                {session.updatedAt > 0 && <span className="session-time">{relativeTime(session.updatedAt)}</span>}
              </button>
              <button
                className="session-delete"
                aria-label={`Delete ${session.title}`}
                onClick={() => onDelete(session.id)}
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

export default Chatsidebar
