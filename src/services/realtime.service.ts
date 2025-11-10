import type { RealtimeAISuggestions } from '../types'

type WSLike = { send: (data: string) => void }

class RealtimeRegistry {
  private clients = new Map<string, WSLike>()
  private all = new Set<WSLike>()
  private userClients = new Map<string, Set<string>>() // userId -> Set of clientIds

  registerClient(clientId: string, ws: WSLike, userId?: string) {
    this.clients.set(clientId, ws)
    this.all.add(ws)

    // Track user's clients for targeted messaging
    if (userId) {
      if (!this.userClients.has(userId)) {
        this.userClients.set(userId, new Set())
      }
      this.userClients.get(userId)?.add(clientId)
    }
  }

  unregisterBySocket(ws: WSLike) {
    this.all.delete(ws)

    // Find and remove from clients and userClients
    for (const [id, socket] of this.clients.entries()) {
      if (socket === ws) {
        this.clients.delete(id)

        // Remove from userClients
        for (const [userId, clientIds] of this.userClients.entries()) {
          if (clientIds.has(id)) {
            clientIds.delete(id)
            if (clientIds.size === 0) {
              this.userClients.delete(userId)
            }
          }
        }
      }
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

  /**
   * Send message to all clients connected by a specific user
   */
  sendToUser(userId: string, payload: unknown) {
    const clientIds = this.userClients.get(userId)
    if (!clientIds || clientIds.size === 0) return false

    const data = JSON.stringify(payload)
    let sent = false

    for (const clientId of clientIds) {
      const ws = this.clients.get(clientId)
      if (ws) {
        try {
          ws.send(data)
          sent = true
        } catch {}
      }
    }

    return sent
  }

  /**
   * Broadcast AI suggestions to user
   */
  broadcastAISuggestions(userId: string, suggestions: RealtimeAISuggestions) {
    return this.sendToUser(userId, {
      type: 'ai_suggestions',
      suggestions: suggestions.suggestions,
      jobId: suggestions.jobId,
      matchScore: suggestions.matchScore,
      estimatedTime: suggestions.estimatedApplicationTime,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Broadcast multi-stage customization progress
   */
  broadcastCustomizationProgress(
    userId: string,
    stage: 'analysis' | 'optimization' | 'validation' | 'cover-letters',
    progress: number,
    data?: any
  ) {
    return this.sendToUser(userId, {
      type: 'customization_progress',
      stage,
      progress,
      data,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Broadcast interview preparation ready notification
   */
  broadcastInterviewPrepReady(userId: string, jobTitle: string, questionsCount: number) {
    return this.sendToUser(userId, {
      type: 'interview_prep_ready',
      jobTitle,
      questionsCount,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Broadcast company culture analysis results
   */
  broadcastCultureAnalysis(
    userId: string,
    companyName: string,
    overallScore: number,
    recommendation: string,
    redFlagsCount: number
  ) {
    return this.sendToUser(userId, {
      type: 'culture_analysis_ready',
      companyName,
      overallScore,
      recommendation,
      redFlagsCount,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Get statistics about connected clients
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      connectedUsers: this.userClients.size,
      activeConnections: this.all.size
    }
  }
}

export const realtime = new RealtimeRegistry()


