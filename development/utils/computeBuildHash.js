const { execSync } = require('child_process');

// Build identifier for the cold-start hydration cache (see
// packages/kit-bg/src/hydration/hydrate.ts). When this value changes
// between deploys, the cold-start IDB is wiped to prevent stale data
// from a prior build leaking into a new code base.
//
// Shared between development/rspack/rspack.base.config.ts and
// development/webpack/webpack.base.config.js.
function computeBuildHash() {
  if (process.env.BUILD_HASH) return process.env.BUILD_HASH;
  // Prefer CI-provided commit SHAs over a local `git rev-parse` so CI
  // builds (where the workspace may be a shallow / detached checkout)
  // still produce a stable identifier.
  const ciSha =
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    process.env.CI_COMMIT_SHA;
  if (ciSha) return ciSha.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return `t${Date.now()}`;
  }
}

module.exports = { computeBuildHash };
