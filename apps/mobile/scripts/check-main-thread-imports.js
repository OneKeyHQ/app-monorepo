#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/**
 * Main-thread import guard.
 *
 * Reads the union-build module-id-map.json and verifies that the `common` and
 * `main` eager buckets do NOT contain modules from forbidden paths.
 *
 * The primary goal is to catch accidental imports from `@onekeyhq/core` in the
 * kit/shared layers that would pull heavy crypto or chain-specific code into
 * the main thread's eager bundle — especially `core/src/secret/curves/` which
 * costs ~1.3s of startup time on real devices due to elliptic curve
 * pre-computation at module evaluation time.
 *
 * Inputs:
 *   - apps/mobile/dist/module-id-map.json (preferred, written by unionBuild.js)
 *   - apps/mobile/out-dir-bundle/<platform>/dist/module-id-map.json (fallback)
 *
 * Exit codes:
 *   0 — clean
 *   1 — violation(s) found or structural problem
 */
const fs = require('fs');
const path = require('path');

const MOBILE_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(MOBILE_DIR, 'dist');

// ── Forbidden patterns ─────────────────────────────────────────────────
// Each entry: { pattern, message }
// `pattern` is tested against the module path string via .includes() or regex.
const FORBIDDEN_IN_EAGER = [
  {
    pattern: 'packages/core/src/secret/curves/',
    message:
      'Elliptic curve modules must not be in eager bundles — they cost ~1.3s of startup (pre-computation at require time).',
  },
  {
    pattern: 'packages/core/src/secret/bip32.ts',
    message: 'BIP-32 key derivation belongs in background thread only.',
  },
  {
    pattern: 'packages/core/src/chains/',
    message:
      'Chain-specific implementations must not be in eager bundles — they belong in background segments.',
  },
];

// ── Locate module-id-map.json ──────────────────────────────────────────
function findModuleIdMap() {
  const primary = path.join(DIST_DIR, 'module-id-map.json');
  if (fs.existsSync(primary)) return primary;
  const outDir = path.join(MOBILE_DIR, 'out-dir-bundle');
  if (!fs.existsSync(outDir)) return null;
  for (const platform of fs.readdirSync(outDir)) {
    const candidate = path.join(outDir, platform, 'dist', 'module-id-map.json');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// ── Core check logic ───────────────────────────────────────────────────
function checkEagerBuckets(idMap, forbiddenPatterns) {
  const violations = [];
  for (const bucket of ['common', 'main']) {
    const modules = idMap[bucket];
    if (!modules) {
      // eslint-disable-next-line no-continue
      continue;
    }
    for (const [moduleId, modulePath] of Object.entries(modules)) {
      for (const rule of forbiddenPatterns) {
        const matches =
          rule.pattern instanceof RegExp
            ? rule.pattern.test(modulePath)
            : modulePath.includes(rule.pattern);
        if (matches) {
          violations.push({
            bucket,
            moduleId: Number(moduleId),
            modulePath,
            rule:
              typeof rule.pattern === 'string'
                ? rule.pattern
                : rule.pattern.source,
            message: rule.message,
          });
        }
      }
    }
  }
  return violations;
}

function formatViolations(violations) {
  // Group by rule for readable output.
  const groups = new Map();
  for (const v of violations) {
    const key = v.rule;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }

  for (const [rule, list] of groups) {
    console.error(`\n  Rule: ${rule}`);
    console.error(`  Reason: ${list[0].message}`);
    console.error(`  ${list.length} violation(s):`);
    for (const v of list.slice(0, 10)) {
      console.error(`    [${v.bucket}] id=${v.moduleId} ${v.modulePath}`);
    }
    if (list.length > 10) {
      console.error(`    ...and ${list.length - 10} more`);
    }
  }
}

// ── main ───────────────────────────────────────────────────────────────
function main() {
  const idMapPath = findModuleIdMap();
  if (!idMapPath) {
    console.error(
      '[check-main-thread-imports] module-id-map.json not found. Run unionBuild first.',
    );
    process.exit(1);
  }

  const idMap = JSON.parse(fs.readFileSync(idMapPath, 'utf8'));

  const violations = checkEagerBuckets(idMap, FORBIDDEN_IN_EAGER);

  const commonCount = Object.keys(idMap.common || {}).length;
  const mainCount = Object.keys(idMap.main || {}).length;
  console.log(
    `[check-main-thread-imports] scanned ${commonCount} common + ${mainCount} main modules against ${FORBIDDEN_IN_EAGER.length} rules`,
  );
  console.log(`[check-main-thread-imports] violations: ${violations.length}`);

  if (violations.length === 0) {
    console.log(
      '[check-main-thread-imports] OK — no forbidden modules in eager bundles.',
    );
    process.exit(0);
  }

  console.error(
    '\n[check-main-thread-imports] FAIL — forbidden modules found in eager bundles:',
  );
  formatViolations(violations);
  console.error(
    '\nEach violation means a module that should only run in the background thread (or a lazy segment) was pulled into the main-thread eager bundle, increasing cold-start time.',
  );
  console.error(
    'Fix: change the import to use shared re-exports, kit-bg service RPC, or import type.',
  );
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkEagerBuckets,
  FORBIDDEN_IN_EAGER,
  findModuleIdMap,
};
