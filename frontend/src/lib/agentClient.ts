// Transport to the agent. Uses the websocket in VITE_WS_URL when set;
// otherwise streams a canned reply so the UI can be developed offline.
//
// Assumed wire format (adjust to the frontend-stack trigger lambda):
//   send:    { session_id, prompt }
//   receive: { type: 'chunk', data: string } ... { type: 'done' }

const WS_URL = import.meta.env.VITE_WS_URL as string | undefined

export interface StreamHandlers {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

export function streamReply(sessionId: string, prompt: string, h: StreamHandlers): () => void {
  return WS_URL ? viaWebSocket(WS_URL, sessionId, prompt, h) : viaMock(prompt, h)
}

function viaWebSocket(url: string, sessionId: string, prompt: string, h: StreamHandlers) {
  const ws = new WebSocket(url)
  let finished = false
  const finish = () => {
    if (!finished) {
      finished = true
      h.onDone()
    }
  }
  ws.onopen = () => ws.send(JSON.stringify({ session_id: sessionId, prompt }))
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'chunk') h.onChunk(msg.data)
      else if (msg.type === 'done') {
        finish()
        ws.close()
      }
    } catch {
      h.onChunk(String(e.data))
    }
  }
  ws.onerror = () => {
    finished = true
    h.onError('Connection error. Please try again.')
  }
  ws.onclose = finish
  return () => {
    finished = true
    ws.close()
  }
}

function viaMock(prompt: string, h: StreamHandlers) {
  const words = `(Mock reply, set VITE_WS_URL to talk to the real agent.) You asked: "${prompt}". Tell me your dates, budget and departure city and I'll start planning flights, stays and an itinerary.`.split(' ')
  let i = 0
  const timer = setInterval(() => {
    if (i >= words.length) {
      clearInterval(timer)
      h.onDone()
      return
    }
    h.onChunk((i === 0 ? '' : ' ') + words[i++])
  }, 40)
  return () => clearInterval(timer)
}
