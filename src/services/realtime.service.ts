type WSLike = { send: (data: string) => void }

class RealtimeRegistry {
  private clients = new Map<string, WSLike>()
  private all = new Set<WSLike>()

  registerClient(clientId: string, ws: WSLike) {
    this.clients.set(clientId, ws)
    this.all.add(ws)
  }

  unregisterBySocket(ws: WSLike) {
    this.all.delete(ws)
    for (const [id, socket] of this.clients.entries()) {
      if (socket === ws) this.clients.delete(id)
    }
  }

  broadcast(payload: unknown) {
    const data = JSON.stringify(payload)
    for (const ws of this.all) {
      try { ws.send(data) } catch {}
    }
  }

  sendToClientId(clientId: string | undefined | null, payload: unknown) {
    if (!clientId) return false
    const ws = this.clients.get(clientId)
    if (!ws) return false
    try {
      ws.send(JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }
}

export const realtime = new RealtimeRegistry()


