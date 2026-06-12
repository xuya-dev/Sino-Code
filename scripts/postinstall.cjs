const { spawnSync } = require('node:child_process')

function run(command, args) {
  return spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
}

require('./ensure-dragon-install.cjs')

const buildDragon = run('npm', ['--prefix', 'dragon', 'run', 'build'])
if (buildDragon.status !== 0) {
  process.exit(buildDragon.status || 1)
}
