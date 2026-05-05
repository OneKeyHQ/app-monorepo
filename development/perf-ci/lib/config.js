const fs = require('fs');
const path = require('path');

function readPerfCiLocalConfig(repoRoot) {
  const p = path.join(repoRoot, 'development', 'perf-ci', 'config.local.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const json = JSON.parse(raw);
    return json && typeof json === 'object' ? json : null;
  } catch {
    return null;
  }
}

module.exports = {
  readPerfCiLocalConfig,
};
