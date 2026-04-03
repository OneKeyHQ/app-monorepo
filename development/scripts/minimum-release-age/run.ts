import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import * as path from 'node:path';

import {
  type ICheckResult,
  type IMinimumReleaseAgeConfig,
  type INpmPackageMeta,
  type IPackageRef,
  checkPackageAge,
  parseConfig,
} from './checkPackageAge';
import { parseFullLockfile, parseLockfileDiff } from './parseLockfileDiff';

// --- Constants ---

const BATCH_SIZE = 10;
const DEFAULT_BASE_BRANCH = 'x';

// --- Registry fetch ---

function fetchRegistryMeta(
  name: string,
  registryUrl: string,
): Promise<INpmPackageMeta> {
  const url = `${registryUrl}/${encodeURIComponent(name).replaceAll('%40', '@')}`;

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client
      .get(url, { headers: { Accept: 'application/json' } }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        let data = '';
        res.on('data', (chunk: string) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as INpmPackageMeta);
          } catch (_e) {
            reject(new Error(`Invalid JSON from ${url}`));
          }
        });
      })
      .on('error', reject);
  });
}

// --- Batch helper ---

async function processBatches(
  packages: IPackageRef[],
  config: IMinimumReleaseAgeConfig,
): Promise<Map<string, ICheckResult>> {
  const results = new Map<string, ICheckResult>();
  const now = new Date();
  const deps = { now, fetchMeta: fetchRegistryMeta };

  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    const batch = packages.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (ref) => {
        const result = await checkPackageAge(ref, config, deps);
        return { ref, result };
      }),
    );
    for (const { ref, result } of batchResults) {
      results.set(`${ref.name}@${ref.version}`, result);
    }
  }

  return results;
}

// --- Output formatting ---

function printResults(
  results: Map<string, ICheckResult>,
  config: IMinimumReleaseAgeConfig,
): { hasTooYoung: boolean; hasErrors: boolean } {
  let okCount = 0;
  let tooYoungCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const tooYoungEntries: Array<{ key: string; ageDays: number }> = [];
  const errorEntries: Array<{ key: string; error: string }> = [];

  for (const [key, result] of results) {
    switch (result.status) {
      case 'ok':
        okCount += 1;
        break;
      case 'too_young':
        tooYoungCount += 1;
        tooYoungEntries.push({ key, ageDays: result.ageDays ?? 0 });
        break;
      case 'skipped':
        skippedCount += 1;
        break;
      case 'error':
        errorCount += 1;
        errorEntries.push({ key, error: result.error ?? 'unknown error' });
        break;
      default:
        break;
    }
  }

  console.log('\n=== Minimum Release Age Check ===\n');

  if (tooYoungEntries.length > 0) {
    console.log(
      `FAIL: ${tooYoungCount} package(s) younger than ${config.days} days:\n`,
    );
    for (const entry of tooYoungEntries) {
      console.log(`  - ${entry.key} (${entry.ageDays} day(s) old)`);
    }
    console.log('');
  }

  if (errorEntries.length > 0) {
    console.log(`ERRORS: ${errorCount} package(s) could not be checked:\n`);
    for (const entry of errorEntries) {
      console.log(`  - ${entry.key}: ${entry.error}`);
    }
    console.log('');
  }

  console.log(
    `Summary: ${okCount} ok, ${tooYoungCount} too young, ${skippedCount} skipped, ${errorCount} errors`,
  );
  console.log(`Total packages checked: ${results.size}\n`);

  return { hasTooYoung: tooYoungCount > 0, hasErrors: errorCount > 0 };
}

// --- Main ---

async function main() {
  const mode = process.argv[2] || 'diff';
  const baseBranch = process.argv[3] || DEFAULT_BASE_BRANCH;

  // Read config from root package.json
  const rootDir = path.resolve(__dirname, '..', '..', '..');
  const pkgJsonPath = path.join(rootDir, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as Record<
    string,
    unknown
  >;
  const config = parseConfig(pkgJson);

  let packages: IPackageRef[];

  if (mode === 'full') {
    console.log('Running full lockfile audit...');
    const lockfilePath = path.join(rootDir, 'yarn.lock');
    const lockfileContent = fs.readFileSync(lockfilePath, 'utf-8');
    packages = parseFullLockfile(lockfileContent);
  } else {
    console.log(`Running diff check against ${baseBranch}...`);
    let diff: string;
    try {
      diff = execFileSync('git', ['diff', baseBranch, '--', 'yarn.lock'], {
        cwd: rootDir,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch (e) {
      console.error('git diff failed:', e instanceof Error ? e.message : e);
      process.exit(1);
    }
    if (!diff.trim()) {
      console.log('No yarn.lock changes detected.');
      process.exit(0);
    }
    packages = parseLockfileDiff(diff);
  }

  if (packages.length === 0) {
    console.log('No new packages to check.');
    process.exit(0);
  }

  console.log(`Found ${packages.length} package(s) to check...\n`);

  const results = await processBatches(packages, config);
  const { hasTooYoung, hasErrors } = printResults(results, config);

  if ((hasTooYoung || hasErrors) && config.blockOnFailure) {
    if (hasTooYoung) {
      console.log(
        'Blocking: one or more packages are younger than the minimum release age threshold.',
      );
    }
    if (hasErrors) {
      console.log(
        'Blocking: one or more packages could not be checked (fail-closed).',
      );
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
