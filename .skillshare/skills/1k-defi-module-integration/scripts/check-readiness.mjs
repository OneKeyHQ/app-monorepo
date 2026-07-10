#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, '..');
const repoRoot = resolve(skillRoot, '../../..');
const reviewedCodeRef = 'ec605542881e33d53f6efe809604b5821ad98351';

const anchors = [
  [
    'packages/kit/src/views/AssetDetails/pages/DeFiProtocolDetails.tsx',
    ['actionPresentation'],
  ],
  [
    'packages/kit/src/views/AssetDetails/pages/DeFiProtocolAction.tsx',
    ['renderMode="page"'],
  ],
  ['packages/shared/src/routes/assetDetails.ts', ['DeFiProtocolAction']],
  [
    'packages/kit/src/components/DeFi/ProtocolPositionActionButton.tsx',
    ['actionPresentation'],
  ],
  [
    'packages/kit/src/components/DeFi/ProtocolLendingActionDialog.ts',
    ['preloadProtocolLendingActionDialog'],
  ],
  [
    'packages/kit/src/components/DeFi/ProtocolLendingActionDialogContent.tsx',
    ['ProtocolLendingActionContent'],
  ],
  [
    'packages/kit/src/components/DeFi/DeFiActionTxConfirmResult.tsx',
    ['showDeFiActionTxConfirmDialog'],
  ],
  [
    'packages/kit/src/views/Borrow/components/ManagePosition/hooks/useBorrowApproveAndSubmit.ts',
    ['useBorrowApproveAndSubmit'],
  ],
  [
    'packages/kit/src/views/Borrow/hooks/useUniversalBorrowWithdrawRepayHooks.ts',
    ['attachBorrowOrderId', 'handleBorrowSuccess'],
  ],
  [
    'packages/shared/src/utils/defiActionUtils.ts',
    ['resolveDeFiActionTxAmount'],
  ],
  ['packages/shared/src/utils/defiPositionMetadataUtils.ts', []],
  [
    'packages/kit/src/views/Home/components/DeFiListBlock/DeFiListBlock.tsx',
    ['currentOwnerKey', 'loadedOwnerKey', 'DeFiPositionRefreshed'],
  ],
  [
    'packages/kit-bg/src/services/ServiceDeFi.ts',
    [
      '_runDeFiForceRefresh',
      'refreshAccountDeFiPositionsAfterAction',
      '40_000',
      '80_000',
    ],
  ],
  [
    'packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityDeFi.ts',
    ['consumeManualForceRefreshQuota'],
  ],
  [
    'packages/kit-bg/src/dbs/simple/base/SimpleDbEntityBase.ts',
    ['storageHub', 'cachedRawData'],
  ],
  [
    'packages/kit/src/states/jotai/contexts/discovery/actions.ts',
    ['handleOpenWebSite'],
  ],
  [
    'packages/kit/src/views/Discovery/components/DiscoveryBrowserProviderMirror.tsx',
    [],
  ],
  [
    'packages/kit/src/views/Discovery/hooks/useDiscoveryMessageHandler.ts',
    ['openSignAndSendTransactionModal'],
  ],
  [
    'packages/kit-bg/src/services/ServiceDApp.ts',
    ['openSignAndSendTransactionModal', 'TxConfirmFromDApp'],
  ],
];

const driftScopes = [
  'packages/kit/src/components/DeFi',
  'packages/kit/src/views/AssetDetails',
  'packages/kit/src/views/Borrow',
  'packages/kit/src/views/Earn',
  'packages/kit/src/views/Staking',
  'packages/kit/src/views/Home/components/DeFiListBlock',
  'packages/kit/src/states/jotai/contexts/deFiList',
  'packages/kit/src/states/jotai/contexts/discovery',
  'packages/kit/src/views/Discovery',
  'packages/kit/src/views/SignatureConfirm',
  'packages/kit-bg/src/services/ServiceDeFi.ts',
  'packages/kit-bg/src/services/ServiceDApp.ts',
  'packages/kit-bg/src/services/ServiceStaking.ts',
  'packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityDeFi.ts',
  'packages/shared/src/utils/defiActionUtils.ts',
  'packages/shared/src/utils/defiPositionMetadataUtils.ts',
  'packages/shared/types/defi.ts',
];

const errors = [];
const warnings = [];

for (const [relativePath, symbols] of anchors) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    errors.push(`missing anchor: ${relativePath}`);
  } else {
    const source = readFileSync(absolutePath, 'utf8');
    for (const symbol of symbols) {
      if (!source.includes(symbol)) {
        errors.push(`missing symbol: ${symbol} in ${relativePath}`);
      }
    }
  }
}

const manifestPath = resolve(skillRoot, 'evals/manifest.yaml');
const rubricPath = resolve(skillRoot, 'evals/rubric.md');
if (!existsSync(manifestPath)) errors.push('missing evals/manifest.yaml');
if (!existsSync(rubricPath)) {
  errors.push('missing evals/rubric.md');
} else {
  const rubric = readFileSync(rubricPath, 'utf8');
  if (!rubric.includes('## Pass Criteria')) {
    errors.push('eval rubric missing ## Pass Criteria');
  }
  if (!rubric.includes('## Critical Fail Criteria')) {
    errors.push('eval rubric missing ## Critical Fail Criteria');
  }
}

if (existsSync(manifestPath)) {
  try {
    const manifest = parse(readFileSync(manifestPath, 'utf8'));
    const casePaths = Array.isArray(manifest?.cases) ? manifest.cases : [];
    if (manifest?.skill !== '1k-defi-module-integration') {
      errors.push('eval manifest skill id is invalid');
    }
    if (!Number.isInteger(manifest?.version) || manifest.version < 1) {
      errors.push('eval manifest version must be a positive integer');
    }
    if (
      !Number.isFinite(manifest?.pass_threshold) ||
      manifest.pass_threshold < 0 ||
      manifest.pass_threshold > 100
    ) {
      errors.push('eval manifest pass_threshold must be within 0..100');
    }
    if (manifest?.critical_fail_policy !== 'zero') {
      errors.push('eval manifest critical_fail_policy must be zero');
    }
    if (manifest?.reviewed_code_ref !== reviewedCodeRef) {
      errors.push('eval manifest reviewed_code_ref does not match the script');
    }
    if (casePaths.length < 3) {
      errors.push('eval manifest must list at least 3 cases');
    }
    if (new Set(casePaths).size !== casePaths.length) {
      errors.push('eval manifest contains duplicate case paths');
    }

    const casesDir = resolve(skillRoot, 'evals/cases');
    const onDiskCasePaths = existsSync(casesDir)
      ? readdirSync(casesDir)
          .filter((name) => name.endsWith('.yaml'))
          .map((name) => `cases/${name}`)
          .toSorted()
      : [];
    if (
      JSON.stringify(casePaths.toSorted()) !== JSON.stringify(onDiskCasePaths)
    ) {
      errors.push('eval manifest must reference every case file exactly once');
    }

    const caseIds = new Set();
    const typeCoverage = new Set();
    const allowedTypes = new Set(['golden', 'negative', 'verification']);
    for (const casePath of casePaths) {
      const absolutePath = resolve(skillRoot, 'evals', casePath);
      if (!existsSync(absolutePath)) {
        errors.push(`missing eval case: ${casePath}`);
      } else {
        try {
          const evalCase = parse(readFileSync(absolutePath, 'utf8'));
          if (typeof evalCase?.id !== 'string' || !evalCase.id.trim()) {
            errors.push(`${casePath} must define a non-empty id`);
          } else if (caseIds.has(evalCase.id)) {
            errors.push(`${casePath} duplicates eval id ${evalCase.id}`);
          } else {
            caseIds.add(evalCase.id);
          }
          if (!Array.isArray(evalCase?.type) || evalCase.type.length === 0) {
            errors.push(`${casePath} must define at least one type`);
          } else {
            for (const type of evalCase.type) {
              if (!allowedTypes.has(type)) {
                errors.push(`${casePath} has unsupported type ${type}`);
              } else {
                typeCoverage.add(type);
              }
            }
          }
          if (typeof evalCase?.prompt !== 'string' || !evalCase.prompt.trim()) {
            errors.push(`${casePath} must define a prompt`);
          }
          if (
            !Array.isArray(evalCase?.expected?.must_include) ||
            evalCase.expected.must_include.length < 4
          ) {
            errors.push(
              `${casePath} must define at least 4 must_include items`,
            );
          }
          if (
            !Array.isArray(evalCase?.expected?.must_not_include) ||
            evalCase.expected.must_not_include.length < 2
          ) {
            errors.push(
              `${casePath} must define at least 2 must_not_include items`,
            );
          }
          if (evalCase?.score?.pass !== manifest.pass_threshold) {
            errors.push(
              `${casePath} score.pass must match manifest pass_threshold`,
            );
          }
          if (
            !Array.isArray(evalCase?.score?.critical_fail_if) ||
            evalCase.score.critical_fail_if.length < 2
          ) {
            errors.push(
              `${casePath} must define at least 2 critical_fail_if items`,
            );
          }
        } catch (error) {
          errors.push(`invalid YAML in ${casePath}: ${error.message}`);
        }
      }
    }
    for (const requiredType of allowedTypes) {
      if (!typeCoverage.has(requiredType)) {
        errors.push(`eval suite missing ${requiredType} coverage`);
      }
    }
  } catch (error) {
    errors.push(`invalid YAML in eval manifest: ${error.message}`);
  }
}

try {
  execFileSync('git', ['cat-file', '-e', `${reviewedCodeRef}^{commit}`], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  execFileSync(
    'git',
    ['merge-base', '--is-ancestor', reviewedCodeRef, 'HEAD'],
    {
      cwd: repoRoot,
      stdio: 'ignore',
    },
  );
  const domainDrift = execFileSync(
    'git',
    ['diff', '--name-only', `${reviewedCodeRef}...HEAD`, '--', ...driftScopes],
    { cwd: repoRoot, encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean);
  const anchorPaths = new Set(anchors.map(([relativePath]) => relativePath));
  const anchorDrift = domainDrift.filter((relativePath) =>
    anchorPaths.has(relativePath),
  );
  if (anchorDrift.length > 0) {
    errors.push(
      `anchor code changed after reviewed ref ${reviewedCodeRef.slice(0, 12)}:\n  ${anchorDrift.join('\n  ')}\nreview the client/server contracts and code map, then advance reviewedCodeRef`,
    );
  }
  const reviewDrift = domainDrift.filter(
    (relativePath) => !anchorPaths.has(relativePath),
  );
  if (reviewDrift.length > 0) {
    warnings.push(
      `domain snapshot has ${reviewDrift.length} non-anchor change(s) after ${reviewedCodeRef.slice(0, 12)}; inspect before implementation:\n  ${reviewDrift.slice(0, 30).join('\n  ')}`,
    );
  }
  const uncommittedDrift = [
    ...execFileSync('git', ['diff', '--name-only', '--', ...driftScopes], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .trim()
      .split('\n'),
    ...execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '--', ...driftScopes],
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n'),
    ...execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard', '--', ...driftScopes],
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n'),
  ].filter(Boolean);
  if (uncommittedDrift.length > 0) {
    errors.push(
      `uncommitted domain code is present:\n  ${[...new Set(uncommittedDrift)].join('\n  ')}\nrun readiness before editing or reconcile this worktree explicitly`,
    );
  }
} catch (error) {
  errors.push(`cannot validate reviewed code ref: ${error.message}`);
}

if (errors.length > 0) {
  console.error(`DeFi skill readiness: FAIL\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(`DeFi skill readiness: REVIEW\n- ${warnings.join('\n- ')}`);
}

console.log(
  `DeFi skill readiness: PASS (${anchors.length} anchors, reviewed ${reviewedCodeRef.slice(0, 12)}, eval schema present)`,
);
