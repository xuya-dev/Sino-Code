const { existsSync, rmSync } = require('node:fs')
const { spawnSync } = require('node:child_process')

const REQUIRED_PATHS = [
  'dragon/package-lock.json',
  'dragon/node_modules/diff/package.json',
  'dragon/node_modules/zod/package.json',
  'dragon/node_modules/@modelcontextprotocol/sdk/package.json'
]
const DRAGON_SQLITE_MODULE_PATH = 'dragon/node_modules/better-sqlite3'

function run(command, args) {
  return spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false'
    }
  })
}

function ensureDragonInstall() {
  if (!REQUIRED_PATHS.every((path) => existsSync(path))) {
    const installDragon = run('npm', ['--prefix', 'dragon', 'ci'])
    if (installDragon.status !== 0) {
      process.exit(installDragon.status || 1)
    }
  }

  if (existsSync(DRAGON_SQLITE_MODULE_PATH)) {
    rmSync(DRAGON_SQLITE_MODULE_PATH, { recursive: true, force: true })
    return
  }
}

ensureDragonInstall()
