// Transport to the agent over the WebSocket API at VITE_WS_URL (e.g. wss://<id>.execute-api.<region>.amazonaws.com/prod).
//
// Protocol:
//   connect: <WS_URL>?sessionid=<id>   (omit sessionid to start a new session)
//   send:    { action: 'chat', prompt }
//   receive: { type: 'session', session_id }   once, when the backend creates a new session
//            { type: 'chunk', data }           streamed reply text
//            { type: 'done' }
//            { type: 'error', data }

const WS_URL = import.meta.env.VITE_WS_URL as string | undefined

export interface StreamHandlers {
  onSession: (sessionId: string) => void
  onChunk: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

export function streamReply(sessionId: string | undefined, prompt: string, handlers: StreamHandlers): () => void {
  if (!WS_URL) {
    handlers.onError('VITE_WS_URL is not set.')
    return () => {}
  }
  return viaWebSocket(WS_URL, sessionId, prompt, handlers)
}

function viaWebSocket(baseUrl: string, sessionId: string | undefined, prompt: string, handlers: StreamHandlers) {
  const url = sessionId ? `${baseUrl}?sessionid=${encodeURIComponent(sessionId)}` : baseUrl
  const webSocket = new WebSocket(url)
  let finished = false
  const finish = () => {
    if (!finished) {
      finished = true
      handlers.onDone()
    }
  }

  webSocket.onopen = () => webSocket.send(JSON.stringify({ action: 'chat', prompt }))
  webSocket.onmessage = (messageEvent) => {
    try {
      const serverMessage = JSON.parse(messageEvent.data)
      if (serverMessage.type === 'session') handlers.onSession(serverMessage.session_id)
      else if (serverMessage.type === 'chunk') handlers.onChunk(serverMessage.data)
      else if (serverMessage.type === 'error') {
        finished = true
        handlers.onError(serverMessage.data)
        webSocket.close()
      } else if (serverMessage.type === 'done') {
        finish()
        webSocket.close()
      }
    } catch {
      handlers.onChunk(String(messageEvent.data))
    }
  }
  webSocket.onerror = () => {
    if (finished) return
    finished = true
    handlers.onError('Connection error. Please try again.')
  }
  webSocket.onclose = finish
  return () => {
    finished = true
    webSocket.close()
  }
}
