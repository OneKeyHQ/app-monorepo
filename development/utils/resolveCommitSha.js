const { execSync } = require('child_process');

// CI sets WORKFLOW_GITHUB_SHA / GITHUB_SHA; local builds fall back to
// `git rev-parse HEAD` so platformEnv.githubSHA — and the cold-start
// hydration cache invalidation gate that reads it — stays accurate
// offline. Empty string only when both env and git are unavailable.
//
// Shared between development/rspack/rspack.base.config.ts and
// development/webpack/webpack.base.config.js. Injected by each
// bundler's DefinePlugin as `process.env.GITHUB_SHA`.
function resolveCommitSha() {
  const fromEnv = process.env.WORKFLOW_GITHUB_SHA || process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execSync('git rev-parse HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

module.exports = { resolveCommitSha };
