import { useCallback, useEffect, useRef, useState } from 'react'
import Chat from './Chat'
import Chatsidebar from './Chatsidebar'
import { streamReply } from '../lib/agentClient'
import type { Session } from '../types'

const STORAGE_KEY = 'airconcierge.sessions'
const uid = () => crypto.randomUUID()

const newSession = (): Session => ({ id: uid(), title: 'New trip', updatedAt: Date.now(), messages: [] })

function load(): Session[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Session[]
    // drop streaming placeholders left over from an interrupted reply
    return raw.map((s) => ({ ...s, messages: s.messages.map((m) => ({ ...m, pending: false })) }))
  } catch {
    return []
  }
}

const Chatwrapper = () => {
  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = load()
    return saved.length ? saved : [newSession()]
  })
  const [activeId, setActiveId] = useState(() => sessions[0].id)
  const [busyId, setBusyId] = useState<string | null>(null)
  const cancel = useRef<(() => void) | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    } catch { /* storage unavailable */ }
  }, [sessions])

  useEffect(() => () => cancel.current?.(), [])

  const patch = useCallback((id: string, fn: (s: Session) => Session) => {
    setSessions((all) => all.map((s) => (s.id === id ? fn(s) : s)))
  }, [])

  const send = (text: string) => {
    const id = activeId
    const replyId = uid()
    patch(id, (s) => ({
      ...s,
      title: s.messages.length === 0 ? text.slice(0, 40) : s.title,
      updatedAt: Date.now(),
      messages: [
        ...s.messages,
        { id: uid(), role: 'user', content: text },
        { id: replyId, role: 'assistant', content: '', pending: true },
      ],
    }))
    setBusyId(id)

    const update = (fn: (c: string) => string, done = false) =>
      patch(id, (s) => ({
        ...s,
        updatedAt: Date.now(),
        messages: s.messages.map((m) =>
          m.id === replyId ? { ...m, content: fn(m.content), pending: !done } : m,
        ),
      }))

    cancel.current = streamReply(id, text, {
      onChunk: (c) => update((prev) => prev + c),
      onDone: () => {
        update((prev) => prev, true)
        setBusyId(null)
      },
      onError: (msg) => {
        update(() => msg, true)
        setBusyId(null)
      },
    })
  }

  const select = (id: string) => setActiveId(id)

  const create = () => {
    const empty = sessions.find((s) => s.messages.length === 0)
    if (empty) return setActiveId(empty.id)
    const s = newSession()
    setSessions((all) => [s, ...all])
    setActiveId(s.id)
  }

  const remove = (id: string) => {
    if (busyId === id) {
      cancel.current?.()
      setBusyId(null)
    }
    const rest = sessions.filter((s) => s.id !== id)
    if (rest.length === 0) {
      const s = newSession()
      setSessions([s])
      setActiveId(s.id)
      return
    }
    setSessions(rest)
    if (id === activeId) setActiveId(rest[0].id)
  }

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0]

  return (
    <div className="app-shell">
      <Chatsidebar
        sessions={sessions}
        activeId={active.id}
        onSelect={select}
        onNew={create}
        onDelete={remove}
      />
      <Chat key={active.id} session={active} busy={busyId === active.id} onSend={send} />
    </div>
  )
}

export default Chatwrapper
