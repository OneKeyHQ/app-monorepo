/**
 * Bundle Architecture CI Check
 *
 * Validates the three-bundle split output against architectural rules:
 * 1. Forbidden modules must not appear in eager bundles
 * 2. Common bundle must not exceed size/module budgets
 * 3. Module-to-bundle assignment must follow dependency rules
 *
 * Reads allocation reports from dist/ (produced by unionBuild.js).
 *
 * Usage:
 *   node scripts/check-bundle-architecture.js
 *
 * Exit codes:
 *   0 - All checks pass
 *   1 - Architecture violations found
 */

const path = require('path');

const fs = require('fs-extra');

const distDir = path.resolve(__dirname, '..', 'dist');

// ─── Configuration ──────────────────────────────────────────────────────────

// Modules that must NEVER appear in the main-only eager bundle.
// Main is UI-only — it should not contain background implementation code.
const FORBIDDEN_IN_MAIN = [
  'packages/kit-bg/src/vaults/',
  'packages/kit-bg/src/services/',
  'packages/core/src/chains/',
];

// npm packages that must NEVER appear in the main eager bundle.
// Phase 1 optimization (2026-04-06) moved these to dynamic imports.
const FORBIDDEN_NPM_IN_MAIN = [
  '@keystonehq/', //      Hardware wallet QR SDK — lazy via qr-wallet-sdk
  '@reown/', //            WalletConnect UI — event-driven lazy mount
  '@bufbuild/protobuf', // Protobuf — transitive dep of @keystonehq
];

// npm packages that must NEVER appear in the common eager bundle.
const FORBIDDEN_NPM_IN_COMMON = [
  'viem/', // EVM library — lazy loaded by background connectors
];

// Module path patterns that must NOT appear in main-runtime segments.
// These are background-only code that should never be reachable from main.
const FORBIDDEN_IN_MAIN_SEGMENTS = [
  {
    pattern: 'packages/core/src/chains/',
    reason: 'Chain implementations belong to background — not main segments',
  },
  {
    pattern: 'packages/kit-bg/src/vaults/',
    reason: 'Vault code belongs to background — not main segments',
  },
];

// Modules that should NOT be in common (they belong to one side only).
// These are architectural warnings, not hard errors.
const SUSPICIOUS_IN_COMMON = [
  {
    pattern: 'packages/kit-bg/src/vaults/',
    reason: 'Vaults should be in segments or bg-only, not in shared eager',
  },
  {
    pattern: 'packages/kit-bg/src/services/',
    reason: 'Services should be in segments or bg-only',
    exclude: ['ServicePassword/biologyAuthUtils'], // Known exception
  },
  {
    pattern: 'packages/core/src/chains/',
    reason: 'Chain implementations should be in segments',
  },
  {
    pattern: 'packages/kit-bg/src/migrations/',
    reason: 'Migrations should be in bg-only',
  },
  {
    pattern: 'packages/kit-bg/src/providers/',
    reason: 'Providers should be in bg-only or segments',
  },
];

// Node modules that should NOT be in common (pulled by wrong deps).
const SUSPICIOUS_NM_IN_COMMON = [
  { pattern: '@polkadot/', reason: 'Chain SDK — should be in segments' },
  { pattern: 'tronweb/', reason: 'Chain SDK — should be in segments' },
  { pattern: 'algosdk/', reason: 'Chain SDK — should be in segments' },
  { pattern: 'xrpl/', reason: 'Chain SDK — should be in segments' },
  {
    pattern: '@metaplex-foundation/',
    reason: 'Chain SDK — should be in segments',
  },
];

// Budget thresholds — calibrated after Phase 1 optimization (2026-04-06).
//   common: 4062 modules / 14.03 MB
//   main:   6679 modules / 29.30 MB
//   bg:     8712 modules / 51.38 MB
// ~15 % headroom above current measurements.
const BUDGETS = {
  commonMaxModules: parseInt(process.env.COMMON_MODULE_BUDGET, 10) || 4700,
  commonMaxSizeMB: parseFloat(process.env.COMMON_SIZE_BUDGET_MB) || 20,
  mainMaxModules: parseInt(process.env.MAIN_MODULE_BUDGET, 10) || 7700,
  bgMaxModules: parseInt(process.env.BG_MODULE_BUDGET, 10) || 10_000,
  maxViolations: parseInt(process.env.MAX_VIOLATIONS, 10) || 0,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadReport(name) {
  const filePath = path.join(distDir, `allocation-report-${name}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function matchesPattern(modulePath, pattern) {
  return modulePath.startsWith(pattern) || modulePath.includes(`/${pattern}`);
}

// ─── Checks ─────────────────────────────────────────────────────────────────

function checkForbiddenModules(report, bundleName, forbiddenPatterns) {
  const errors = [];
  const modules = report.startup.modules;

  for (const mod of modules) {
    for (const pattern of forbiddenPatterns) {
      if (matchesPattern(mod, pattern)) {
        errors.push(
          `[${bundleName}] Forbidden module in eager: ${mod} (matches ${pattern})`,
        );
      }
    }
  }
  return errors;
}

function checkSuspiciousInCommon(report) {
  const warnings = [];
  const modules = report.startup.modules;

  for (const mod of modules) {
    // Check OneKey source
    for (const rule of SUSPICIOUS_IN_COMMON) {
      if (matchesPattern(mod, rule.pattern)) {
        const excluded = rule.exclude?.some((ex) => mod.includes(ex));
        if (!excluded) {
          warnings.push(`[common] Suspicious: ${mod} — ${rule.reason}`);
        }
      }
    }

    // Check node_modules
    if (mod.startsWith('node_modules/')) {
      for (const rule of SUSPICIOUS_NM_IN_COMMON) {
        if (mod.includes(rule.pattern)) {
          warnings.push(
            `[common] Suspicious npm: ${mod.split('/').slice(1, 3).join('/')} — ${rule.reason}`,
          );
        }
      }
    }
  }

  // Deduplicate npm warnings (report per package, not per file)
  const seen = new Set();
  return warnings.filter((w) => {
    if (seen.has(w)) return false;
    seen.add(w);
    return true;
  });
}

function checkBudgets(common, mainReport, bg) {
  const errors = [];

  if (common) {
    const { moduleCount, estimatedSizeBytes } = common.startup;
    const sizeMB = estimatedSizeBytes / 1024 / 1024;
    if (moduleCount > BUDGETS.commonMaxModules) {
      errors.push(
        `[budget] Common modules ${moduleCount} > ${BUDGETS.commonMaxModules}`,
      );
    }
    if (sizeMB > BUDGETS.commonMaxSizeMB) {
      errors.push(
        `[budget] Common size ${sizeMB.toFixed(1)} MB > ${BUDGETS.commonMaxSizeMB} MB`,
      );
    }
  }

  if (mainReport) {
    const { moduleCount } = mainReport.startup;
    if (moduleCount > BUDGETS.mainMaxModules) {
      errors.push(
        `[budget] Main-only modules ${moduleCount} > ${BUDGETS.mainMaxModules}`,
      );
    }
  }

  if (bg) {
    const { moduleCount } = bg.startup;
    if (moduleCount > BUDGETS.bgMaxModules) {
      errors.push(
        `[budget] BG-only modules ${moduleCount} > ${BUDGETS.bgMaxModules}`,
      );
    }
  }

  return errors;
}

function checkViolations(report, bundleName) {
  const violations = report.violations || [];
  if (violations.length > BUDGETS.maxViolations) {
    return [
      `[${bundleName}] ${violations.length} startup violations (max: ${BUDGETS.maxViolations})`,
    ];
  }
  return [];
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('Bundle Architecture Check');
  console.log('='.repeat(60));

  const common = loadReport('common');
  const mainReport = loadReport('main');
  const bg = loadReport('background');

  if (!common && !mainReport) {
    console.log(
      'No allocation reports found in dist/. Run unionBuild.js first.',
    );
    process.exit(0);
  }

  const errors = [];
  const warnings = [];

  // 1. Check forbidden modules in main
  if (mainReport) {
    errors.push(
      ...checkForbiddenModules(mainReport, 'main', FORBIDDEN_IN_MAIN),
    );
    errors.push(...checkViolations(mainReport, 'main'));
  }

  // 2. Check forbidden npm packages (Phase 1 optimization guard)
  if (mainReport) {
    const mainMods = mainReport.startup.modules;
    for (const pattern of FORBIDDEN_NPM_IN_MAIN) {
      const matches = mainMods.filter((m) => m.includes(pattern));
      if (matches.length > 0) {
        errors.push(
          `[main] Forbidden npm "${pattern}" in eager startup (${matches.length} modules). Use dynamic import().`,
        );
      }
    }
  }
  if (common) {
    const commonMods = common.startup.modules;
    for (const pattern of FORBIDDEN_NPM_IN_COMMON) {
      const matches = commonMods.filter((m) => m.includes(pattern));
      if (matches.length > 0) {
        errors.push(
          `[common] Forbidden npm "${pattern}" in eager startup (${matches.length} modules). Must not be eagerly loaded.`,
        );
      }
    }
  }

  // 3. Check forbidden modules in main-runtime segments.
  // Background-only code (core/chains, kit-bg/vaults) must not appear
  // in segments with runtime=main — it means the main graph has an
  // unexpected sync import path pulling background code into UI segments.
  {
    const manifestPath = path.join(distDir, 'segment-manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const segments = manifest.segments || {};
      for (const [segKey, segInfo] of Object.entries(segments)) {
        // oxlint-disable-next-line eslint/no-continue
        if (segInfo.runtime !== 'main') continue;
        for (const rule of FORBIDDEN_IN_MAIN_SEGMENTS) {
          if (
            segKey.includes(
              rule.pattern
                .replace(/\//g, '.')
                .replace('packages.', '')
                .replace('.src.', '.'),
            )
          ) {
            errors.push(
              `[segment] ${segKey} has runtime=main but matches forbidden pattern "${rule.pattern}" — ${rule.reason}`,
            );
          }
        }
      }
    }
  }

  // 4. Check suspicious modules in common
  if (common) {
    warnings.push(...checkSuspiciousInCommon(common));
    errors.push(...checkViolations(common, 'common'));
  }

  // 4. Check budgets
  errors.push(...checkBudgets(common, mainReport, bg));

  // ── Summary ─────────────────────────────────────────────────────────────

  if (common) {
    const c = common.startup;
    console.log(
      `  common:    ${c.moduleCount.toLocaleString()} modules, ${(c.estimatedSizeBytes / 1024 / 1024).toFixed(1)} MB`,
    );
  }
  if (mainReport) {
    const m = mainReport.startup;
    console.log(
      `  main-only: ${m.moduleCount.toLocaleString()} modules, ${(m.estimatedSizeBytes / 1024 / 1024).toFixed(1)} MB`,
    );
  }
  if (bg) {
    const b = bg.startup;
    console.log(
      `  bg-only:   ${b.moduleCount.toLocaleString()} modules, ${(b.estimatedSizeBytes / 1024 / 1024).toFixed(1)} MB`,
    );
  }
  console.log();

  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):`);
    for (const w of warnings.slice(0, 20)) {
      console.log(`  WARN: ${w}`);
    }
    if (warnings.length > 20) {
      console.log(`  ... and ${warnings.length - 20} more`);
    }
    console.log();
  }

  if (errors.length > 0) {
    console.log(`ERRORS (${errors.length}):`);
    for (const e of errors) {
      console.log(`  ERROR: ${e}`);
    }
    console.log();
    console.log('Bundle architecture check FAILED');
    process.exit(1);
  }

  console.log('Bundle architecture check PASSED');
}

main();
