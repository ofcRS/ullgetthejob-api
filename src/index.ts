import { app } from './app'
import { env } from './config/env'

const server = app.listen(env.PORT)
console.log(`API listening on http://localhost:${env.PORT}`)

export type ServerType = typeof server

