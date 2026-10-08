import type { Session } from '../types'

interface Props {
  sessions: Session[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function relativeTime(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const Chatsidebar = ({ sessions, activeId, onSelect, onNew, onDelete }: Props) => {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">✈ Air Concierge</div>
      <button className="new-chat" onClick={onNew}>+ New trip</button>
      <div className="sidebar-label">Past sessions</div>
      <ul className="session-list">
        {sorted.map((s) => {
          const last = s.messages[s.messages.length - 1]
          return (
            <li key={s.id}>
              <button
                className={'session' + (s.id === activeId ? ' active' : '')}
                onClick={() => onSelect(s.id)}
              >
                <span className="session-title">{s.title}</span>
                <span className="session-preview">
                  {last ? last.content.slice(0, 60) : 'No messages yet'}
                </span>
                <span className="session-time">{relativeTime(s.updatedAt)}</span>
              </button>
              <button
                className="session-delete"
                aria-label={`Delete ${s.title}`}
                onClick={() => onDelete(s.id)}
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
