const { spawnSync } = require('node:child_process');

const buildScript =
  process.env.EXT_CHANNEL === 'firefox'
    ? 'build:v3:unprotected'
    : 'build:v3:lavamoat';
const result = spawnSync(`yarn run ${buildScript}`, {
  shell: true,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
