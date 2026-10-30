import { useCallback, useEffect, useRef, useState } from 'react'
import Chat from './Chat'
import Chatsidebar from './Chatsidebar'
import { streamReply } from '../lib/agentClient'
import { fetchChatHistory, fetchSessions } from '../lib/api'
import type { Message, Session } from '../types'

const generateId = () => crypto.randomUUID()

const newSession = (): Session => ({ id: generateId(), title: 'New trip', updatedAt: Date.now(), messages: [] })

const Chatwrapper = () => {
  const [sessions, setSessions] = useState<Session[]>(() => [newSession()])
  const [activeId, setActiveId] = useState(() => sessions[0].id)
  const [busySessionId, setBusySessionId] = useState<string | null>(null)
  const cancelStream = useRef<(() => void) | null>(null)

  useEffect(() => {
    fetchSessions()
      .then((sessionSummaries) =>
        setSessions((currentSessions) => {
          const knownRemoteIds = new Set(currentSessions.map((session) => session.remoteId))
          const fetchedSessions: Session[] = sessionSummaries
            .filter((summary) => !knownRemoteIds.has(summary.session_id))
            .map((summary) => ({
              id: summary.session_id,
              remoteId: summary.session_id,
              title: summary['session name'] || 'Untitled trip',
              updatedAt: 0,
              messages: [],
              loaded: false,
            }))
          return [...currentSessions, ...fetchedSessions]
        }),
      )
      .catch((error) => console.error('Could not load sessions', error))
  }, [])

  useEffect(() => () => cancelStream.current?.(), [])

  const updateSession = useCallback((sessionId: string, update: (session: Session) => Session) => {
    setSessions((currentSessions) =>
      currentSessions.map((session) => (session.id === sessionId ? update(session) : session)),
    )
  }, [])

  const send = (text: string) => {
    const sessionId = activeId
    const remoteId = sessions.find((session) => session.id === sessionId)?.remoteId
    const replyId = generateId()
    updateSession(sessionId, (session) => ({
      ...session,
      title: session.messages.length === 0 ? text.slice(0, 40) : session.title,
      updatedAt: Date.now(),
      messages: [
        ...session.messages,
        { id: generateId(), role: 'user', content: text },
        { id: replyId, role: 'assistant', content: '', pending: true },
      ],
    }))
    setBusySessionId(sessionId)

    const updateReply = (updateContent: (content: string) => string, done = false) =>
      updateSession(sessionId, (session) => ({
        ...session,
        updatedAt: Date.now(),
        messages: session.messages.map((message) =>
          message.id === replyId
            ? { ...message, content: updateContent(message.content), pending: !done }
            : message,
        ),
      }))

    cancelStream.current = streamReply(remoteId, text, {
      onSession: (newRemoteId) =>
        updateSession(sessionId, (session) => ({ ...session, remoteId: newRemoteId, loaded: true })),
      onChunk: (chunk) => updateReply((content) => content + chunk),
      onDone: () => {
        updateReply((content) => content, true)
        setBusySessionId(null)
      },
      onError: (errorMessage) => {
        updateReply(() => errorMessage, true)
        setBusySessionId(null)
      },
    })
  }

  const select = (sessionId: string) => {
    setActiveId(sessionId)
    const selectedSession = sessions.find((session) => session.id === sessionId)
    if (!selectedSession?.remoteId || selectedSession.loaded !== false) return

    fetchChatHistory(selectedSession.remoteId)
      .then((history) => {
        const messages: Message[] = history.map((historyMessage) => ({
          id: generateId(),
          role: historyMessage.role,
          content: historyMessage.content,
        }))
        updateSession(sessionId, (session) => ({ ...session, loaded: true, messages }))
      })
      .catch((error) => console.error('Could not load chat history', error))
  }

  const create = () => {
    const emptySession = sessions.find((session) => session.messages.length === 0)
    if (emptySession) return setActiveId(emptySession.id)
    const session = newSession()
    setSessions((currentSessions) => [session, ...currentSessions])
    setActiveId(session.id)
  }

  const remove = (sessionId: string) => {
    if (busySessionId === sessionId) {
      cancelStream.current?.()
      setBusySessionId(null)
    }
    const remainingSessions = sessions.filter((session) => session.id !== sessionId)
    if (remainingSessions.length === 0) {
      const session = newSession()
      setSessions([session])
      setActiveId(session.id)
      return
    }
    setSessions(remainingSessions)
    if (sessionId === activeId) setActiveId(remainingSessions[0].id)
  }

  const activeSession = sessions.find((session) => session.id === activeId) ?? sessions[0]

  return (
    <div className="app-shell">
      <Chatsidebar
        sessions={sessions}
        activeId={activeSession.id}
        onSelect={select}
        onNew={create}
        onDelete={remove}
      />
      <Chat
        key={activeSession.id}
        session={activeSession}
        busy={busySessionId === activeSession.id}
        onSend={send}
      />
    </div>
  )
}

export default Chatwrapper
