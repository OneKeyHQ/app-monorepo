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
  'packages/kit-bg/src/services/ServiceSwap',
  'packages/kit-bg/src/services/ServiceNotification',
  'packages/kit-bg/src/services/ServiceCloudBackup',
  'packages/kit-bg/src/services/ServiceWalletConnect',
  'packages/core/src/chains/',
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
  { pattern: '@metaplex-foundation/', reason: 'Chain SDK — should be in segments' },
];

// Budget thresholds
const BUDGETS = {
  commonMaxModules: parseInt(process.env.COMMON_MODULE_BUDGET, 10) || 6500,
  commonMaxSizeMB: parseFloat(process.env.COMMON_SIZE_BUDGET_MB) || 30,
  mainMaxModules: parseInt(process.env.MAIN_MODULE_BUDGET, 10) || 4000,
  bgMaxModules: parseInt(process.env.BG_MODULE_BUDGET, 10) || 4000,
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
        errors.push(`[${bundleName}] Forbidden module in eager: ${mod} (matches ${pattern})`);
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
          warnings.push(`[common] Suspicious npm: ${mod.split('/').slice(1, 3).join('/')} — ${rule.reason}`);
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

function checkBudgets(common, main, bg) {
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

  if (main) {
    const { moduleCount } = main.startup;
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
    errors.push(...checkForbiddenModules(mainReport, 'main', FORBIDDEN_IN_MAIN));
    errors.push(...checkViolations(mainReport, 'main'));
  }

  // 2. Check suspicious modules in common
  if (common) {
    warnings.push(...checkSuspiciousInCommon(common));
    errors.push(...checkViolations(common, 'common'));
  }

  // 3. Check budgets
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
