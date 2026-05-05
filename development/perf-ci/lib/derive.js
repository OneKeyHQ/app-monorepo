const path = require('path');

const { execCmd } = require('./exec');
const { readJson } = require('./fs');

async function deriveSession({ repoRoot, sessionsDir, sessionId, outPath }) {
  const res = await execCmd(
    'node',
    [
      'development/performance-server/cli/derive-session.js',
      sessionId,
      '--output',
      outPath,
      '--pretty',
    ],
    {
      cwd: repoRoot,
      env: {
        PERF_OUTPUT_DIR: sessionsDir,
      },
    },
  );

  if (res.code !== 0) {
    throw new Error(
      `derive-session failed for ${sessionId}: ${res.stderr || res.stdout}`,
    );
  }

  return readJson(outPath);
}

function defaultDerivedOutPath({ derivedDir, sessionId }) {
  return path.join(derivedDir, `${sessionId}.json`);
}

module.exports = {
  defaultDerivedOutPath,
  deriveSession,
};
