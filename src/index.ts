import { app } from './app'
import { queueWorker } from './workers/queue-worker'
import { env } from './config/env'

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`)
  queueWorker.start()
})

export type ServerType = typeof server

