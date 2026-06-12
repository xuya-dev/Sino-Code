import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildDragonServeArgs,
  resolveDragonExecutable,
  type DragonBinaryResolution
} from './resolve-dragon-binary'

const tempRoots: string[] = []

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'dragon-resolver-'))
  tempRoots.push(root)
  return root
}

function touch(path: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, '', 'utf8')
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
})

describe('resolveDragonExecutable', () => {
  it('resolves the built Dragon entry from the app root', () => {
    const root = tempRoot()
    const entry = join(root, 'dragon/dist/cli/serve-entry.js')
    touch(entry)

    const resolution = resolveDragonExecutable(root, '')

    expect(resolution).toEqual({
      kind: 'node-script',
      command: process.execPath,
      args: [entry],
      dataDir: ''
    })
  })

  it('does not fall back to TypeScript source files that Node cannot execute', () => {
    const root = tempRoot()
    touch(join(root, 'dragon/src/cli/serve-entry.ts'))

    const resolution = resolveDragonExecutable(root, '')

    expect(resolution).toEqual({
      kind: 'node-script',
      command: process.execPath,
      args: [join(root, 'dragon/dist/cli/serve-entry.js')],
      dataDir: ''
    })
  })

  it('accepts a Dragon package directory as a custom binary path', () => {
    const root = tempRoot()
    const entry = join(root, 'dist/cli/serve-entry.js')
    touch(entry)

    const resolution = resolveDragonExecutable('/app', root)

    expect(resolution).toEqual({
      kind: 'node-script',
      command: process.execPath,
      args: [entry],
      dataDir: ''
    })
  })

  it('runs a non-JavaScript custom executable directly', () => {
    const resolution = resolveDragonExecutable('/app', '/usr/local/bin/dragon')

    expect(resolution).toEqual({
      kind: 'custom',
      command: '/usr/local/bin/dragon',
      args: [],
      dataDir: ''
    })
  })
})

describe('buildDragonServeArgs', () => {
  it('does not place runtime secrets on the child process argv', () => {
    const resolution: DragonBinaryResolution = {
      kind: 'node-script',
      command: '/usr/bin/node',
      args: ['/app/dragon/dist/cli/serve-entry.js'],
      dataDir: ''
    }

    const args = buildDragonServeArgs({
      resolution,
      host: '127.0.0.1',
      port: 8899,
      dataDir: '/tmp/dragon',
      baseUrl: 'https://api.deepseek.com/beta',
      endpointFormat: 'responses',
      model: 'deepseek-chat',
      approvalPolicy: 'on-request',
      sandboxMode: 'workspace-write',
      tokenEconomyMode: false,
      insecure: false
    })

    expect(args).not.toContain('--api-key')
    expect(args).not.toContain('--runtime-token')
    expect(args).toContain('--endpoint-format')
    expect(args).toContain('responses')
    expect(args).toContain('--token-economy-mode')
    expect(args).toContain('false')
  })
})
