#!/usr/bin/env node
import process from 'node:process'
import { parseServeOptionsSafe, SERVE_USAGE, ServeExitCode } from './serve.js'
import {
  DRAGON_CLI_USAGE,
  runAgentCommand,
  splitDragonCliCommand
} from './agent-cli.js'
import { startDragonServe } from '../server/runtime-factory.js'

export const DRAGON_READY_PREFIX = 'DRAGON_READY '

/**
 * Serve-mode command. Kept separate from the dispatcher so GUI startup
 * still has the exact same DRAGON_READY handshake behavior.
 */
async function serveMain(argv: readonly string[]): Promise<number> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(SERVE_USAGE)
    return ServeExitCode.ok
  }
  const parsed = parseServeOptionsSafe(argv, process.env)
  if (!parsed.ok) {
    process.stderr.write(`dragon serve: ${parsed.message}\n`)
    if (parsed.issues) {
      process.stderr.write(`${JSON.stringify(parsed.issues, null, 2)}\n`)
    }
    return parsed.exitCode
  }
  const handle = await startDragonServe(parsed.options)
  const info = handle.runtime.info()
  const startupInfo = {
    service: 'dragon',
    mode: 'serve',
    host: handle.host,
    port: handle.port,
    configPath: info.configPath,
    dataDir: info.dataDir,
    model: info.model,
    approvalPolicy: info.approvalPolicy,
    sandboxMode: info.sandboxMode,
    insecure: info.insecure,
    startedAt: info.startedAt,
    pid: info.pid,
    message: `dragon runtime listening on http://${handle.host}:${handle.port}`
  }
  process.stdout.write(`${DRAGON_READY_PREFIX}${JSON.stringify(startupInfo)}\n`)
  process.stdout.write(JSON.stringify(startupInfo, null, 2) + '\n')
  await new Promise<void>((resolve) => {
    const stop = () => {
      void handle.close().finally(resolve)
    }
    process.once('SIGTERM', stop)
    process.once('SIGINT', stop)
  })
  return ServeExitCode.ok
}

export async function main(argv: readonly string[]): Promise<number> {
  const command = splitDragonCliCommand(argv)
  if (command.command === 'help') {
    if (command.error) {
      process.stderr.write(`dragon: ${command.error}\n`)
      process.stderr.write(DRAGON_CLI_USAGE)
      return ServeExitCode.usage
    }
    process.stdout.write(DRAGON_CLI_USAGE)
    return ServeExitCode.ok
  }
  if (command.command === 'serve') {
    return serveMain(command.args)
  }
  return runAgentCommand(command.command, command.args, {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    cwd: () => process.cwd()
  })
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exit(code)
  },
  (error) => {
    process.stderr.write(`dragon serve: ${String(error)}\n`)
    process.exit(ServeExitCode.runtime)
  }
)
