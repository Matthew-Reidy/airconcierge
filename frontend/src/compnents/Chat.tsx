import { useEffect, useRef, useState } from 'react'
import type { Session } from '../types'

interface Props {
  session: Session
  busy: boolean
  onSend: (text: string) => void
}

const Chat = ({ session, busy, onSend }: Props) => {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.messages])

  const submit = () => {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    onSend(text)
  }

  return (
    <section className="chat">
      <header className="chat-header">{session.title}</header>
      <div className="messages">
        {session.messages.length === 0 && (
          <div className="empty">
            <h2>Where to next?</h2>
            <p>Describe your trip and I'll help with flights, stays and an itinerary.</p>
          </div>
        )}
        {session.messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="bubble">
              {m.content || (m.pending ? <span className="typing">…</span> : '')}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <textarea
          value={draft}
          rows={1}
          placeholder="Message Air Concierge…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button type="submit" disabled={busy || !draft.trim()}>Send</button>
      </form>
    </section>
  )
}

export default Chat
