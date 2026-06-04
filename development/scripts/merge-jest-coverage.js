#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..', '..');
const metrics = ['statements', 'branches', 'functions', 'lines'];
const lcovFunctionDataPrefix = ['FN', 'DA'].join('');
const lcovBranchDataPrefix = ['BR', 'DA'].join('');

function collectCoverageFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCoverageFiles(entryPath));
    } else if (entry.name === 'coverage-final.json') {
      files.push(entryPath);
    }
  }
  return files;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function addCountMap(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function addBranchMap(target, source) {
  for (const [key, values] of Object.entries(source ?? {})) {
    const existingValues = target[key] ?? [];
    target[key] = values.map(
      (value, index) => value + (existingValues[index] ?? 0),
    );
  }
}

function mergeFileCoverage(target, source) {
  addCountMap(target.s, source.s);
  addCountMap(target.f, source.f);
  addBranchMap(target.b, source.b);
}

function readCoverageMap(coverageFiles) {
  const coverageMap = {};

  for (const file of coverageFiles) {
    const shardCoverage = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const [coveredFile, fileCoverage] of Object.entries(shardCoverage)) {
      if (coverageMap[coveredFile]) {
        mergeFileCoverage(coverageMap[coveredFile], fileCoverage);
      } else {
        coverageMap[coveredFile] = cloneJson(fileCoverage);
      }
    }
  }

  return coverageMap;
}

function rawPercent(covered, total) {
  if (total === 0) {
    return 100;
  }
  return (covered / total) * 100;
}

function percent(covered, total) {
  return Number(rawPercent(covered, total).toFixed(2));
}

function createMetricSummary(total, covered) {
  return {
    total,
    covered,
    skipped: 0,
    pct: percent(covered, total),
  };
}

function getLineCounts(fileCoverage) {
  const lineCounts = new Map();
  const statementMap = fileCoverage.statementMap ?? {};
  const statementHits = fileCoverage.s ?? {};

  for (const [statementId, location] of Object.entries(statementMap)) {
    const line = location?.start?.line;
    if (typeof line === 'number') {
      const hits = statementHits[statementId] ?? 0;
      lineCounts.set(line, Math.max(lineCounts.get(line) ?? 0, hits));
    }
  }

  return lineCounts;
}

function summarizeFileCoverage(fileCoverage) {
  const statementIds = Object.keys(fileCoverage.statementMap ?? {});
  const functionIds = Object.keys(fileCoverage.fnMap ?? {});
  const branchIds = Object.keys(fileCoverage.branchMap ?? {});
  const lineCounts = getLineCounts(fileCoverage);

  const statementsCovered = statementIds.filter(
    (statementId) => (fileCoverage.s?.[statementId] ?? 0) > 0,
  ).length;
  const functionsCovered = functionIds.filter(
    (functionId) => (fileCoverage.f?.[functionId] ?? 0) > 0,
  ).length;

  let branchesTotal = 0;
  let branchesCovered = 0;
  for (const branchId of branchIds) {
    const branchHits = fileCoverage.b?.[branchId] ?? [];
    branchesTotal += branchHits.length;
    branchesCovered += branchHits.filter((hits) => hits > 0).length;
  }

  const linesTotal = lineCounts.size;
  const linesCovered = Array.from(lineCounts.values()).filter(
    (hits) => hits > 0,
  ).length;

  return {
    lines: createMetricSummary(linesTotal, linesCovered),
    statements: createMetricSummary(statementIds.length, statementsCovered),
    functions: createMetricSummary(functionIds.length, functionsCovered),
    branches: createMetricSummary(branchesTotal, branchesCovered),
  };
}

function addSummary(target, source) {
  for (const metric of metrics) {
    target[metric].total += source[metric].total;
    target[metric].covered += source[metric].covered;
    target[metric].skipped += source[metric].skipped;
    target[metric].pct = percent(target[metric].covered, target[metric].total);
  }
}

function summarizeCoverageMap(coverageMap) {
  const summary = {
    total: Object.fromEntries(
      metrics.map((metric) => [metric, createMetricSummary(0, 0)]),
    ),
  };

  for (const [coveredFile, fileCoverage] of Object.entries(coverageMap)) {
    const fileSummary = summarizeFileCoverage(fileCoverage);
    summary[coveredFile] = fileSummary;
    addSummary(summary.total, fileSummary);
  }

  return summary;
}

function normalizeCoverageThresholds(value, sourceName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${sourceName} must be an object`);
  }

  const thresholds = {};
  for (const metric of metrics) {
    const threshold = value[metric];
    if (threshold !== undefined) {
      if (typeof threshold !== 'number' || Number.isNaN(threshold)) {
        throw new Error(
          `Invalid coverage threshold for ${metric} in ${sourceName}: ${threshold}`,
        );
      }
      thresholds[metric] = threshold;
    }
  }

  if (Object.keys(thresholds).length === 0) {
    throw new Error(
      `${sourceName} did not contain any global coverage thresholds`,
    );
  }

  return thresholds;
}

function readGlobalCoverageThreshold() {
  const envValue = process.env.JEST_COVERAGE_THRESHOLD_JSON;
  if (envValue) {
    return normalizeCoverageThresholds(
      JSON.parse(envValue),
      'JEST_COVERAGE_THRESHOLD_JSON',
    );
  }

  const configPath = path.join(rootDir, 'jest.config.js');
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const thresholdMatch = configContent.match(
    /coverageThreshold\s*:\s*\{\s*global\s*:\s*\{([\s\S]*?)\}\s*,?\s*\}/m,
  );

  if (!thresholdMatch) {
    throw new Error(
      'Unable to find coverageThreshold.global in jest.config.js. Set JEST_COVERAGE_THRESHOLD_JSON to avoid disabling coverage thresholds.',
    );
  }

  const thresholds = {};
  const thresholdBlock = thresholdMatch[1];
  const propertyPattern = /([A-Za-z]+)\s*:\s*(-?\d+(?:\.\d+)?)/g;
  let propertyMatch = propertyPattern.exec(thresholdBlock);
  while (propertyMatch) {
    thresholds[propertyMatch[1]] = Number(propertyMatch[2]);
    propertyMatch = propertyPattern.exec(thresholdBlock);
  }

  return normalizeCoverageThresholds(
    thresholds,
    'jest.config.js coverageThreshold.global',
  );
}

function recreateDir(dir) {
  const resolvedDir = path.resolve(dir);
  if (resolvedDir === rootDir || resolvedDir === path.parse(resolvedDir).root) {
    throw new Error(`Refusing to recreate unsafe output directory: ${dir}`);
  }

  fs.rmSync(resolvedDir, { recursive: true, force: true });
  fs.mkdirSync(resolvedDir, { recursive: true });
}

function getFunctionName(functionId, functionMapEntry) {
  return functionMapEntry.name || `(anonymous_${functionId})`;
}

function writeLcov(coverageMap, outputDir) {
  const records = [];

  for (const [coveredFile, fileCoverage] of Object.entries(
    coverageMap,
  ).toSorted()) {
    const lines = [];
    const functionMap = fileCoverage.fnMap ?? {};
    const functionHits = fileCoverage.f ?? {};
    const branchMap = fileCoverage.branchMap ?? {};
    const branchHits = fileCoverage.b ?? {};
    const lineCounts = getLineCounts(fileCoverage);

    lines.push('TN:');
    lines.push(`SF:${coveredFile}`);

    for (const [functionId, functionMapEntry] of Object.entries(functionMap)) {
      const functionName = getFunctionName(functionId, functionMapEntry);
      const functionLine =
        functionMapEntry.decl?.start?.line ??
        functionMapEntry.loc?.start?.line ??
        0;
      lines.push(`FN:${functionLine},${functionName}`);
    }
    for (const [functionId, functionMapEntry] of Object.entries(functionMap)) {
      const functionName = getFunctionName(functionId, functionMapEntry);
      lines.push(
        `${lcovFunctionDataPrefix}:${functionHits[functionId] ?? 0},${functionName}`,
      );
    }
    lines.push(`FNF:${Object.keys(functionMap).length}`);
    lines.push(
      `FNH:${Object.values(functionHits).filter((hits) => hits > 0).length}`,
    );

    for (const [line, hits] of Array.from(lineCounts.entries()).toSorted(
      ([lineA], [lineB]) => lineA - lineB,
    )) {
      lines.push(`DA:${line},${hits}`);
    }
    lines.push(`LF:${lineCounts.size}`);
    lines.push(
      `LH:${Array.from(lineCounts.values()).filter((hits) => hits > 0).length}`,
    );

    let branchesTotal = 0;
    let branchesCovered = 0;
    Object.entries(branchMap).forEach(
      ([branchId, branchMapEntry], blockIndex) => {
        const hitsForBranch = branchHits[branchId] ?? [];
        const branchLine =
          branchMapEntry.line ?? branchMapEntry.loc?.start?.line ?? 0;
        hitsForBranch.forEach((hits, branchIndex) => {
          branchesTotal += 1;
          if (hits > 0) {
            branchesCovered += 1;
          }
          lines.push(
            `${lcovBranchDataPrefix}:${branchLine},${blockIndex},${branchIndex},${hits ?? '-'}`,
          );
        });
      },
    );
    lines.push(`BRF:${branchesTotal}`);
    lines.push(`BRH:${branchesCovered}`);
    lines.push('end_of_record');

    records.push(lines.join('\n'));
  }

  fs.writeFileSync(
    path.join(outputDir, 'lcov.info'),
    `${records.join('\n')}\n`,
  );
}

function writeCoverageReports(coverageMap, summary, outputDir) {
  recreateDir(outputDir);
  fs.writeFileSync(
    path.join(outputDir, 'coverage-final.json'),
    JSON.stringify(coverageMap, null, 2),
  );
  fs.writeFileSync(
    path.join(outputDir, 'coverage-summary.json'),
    JSON.stringify(summary, null, 2),
  );
  writeLcov(coverageMap, outputDir);
}

function formatPercent(value, fractionDigits = 2) {
  return `${value.toFixed(fractionDigits).replace(/\.?0+$/, '')}%`;
}

function checkCoverageThresholds(summary, thresholds) {
  const failures = [];

  for (const metric of metrics) {
    const threshold = thresholds[metric];
    if (typeof threshold === 'number') {
      const metricSummary = summary.total[metric];
      const metricPercent = rawPercent(
        metricSummary.covered,
        metricSummary.total,
      );
      if (threshold >= 0 && metricPercent < threshold) {
        failures.push(
          `${metric}: ${formatPercent(metricPercent, 4)} (${metricSummary.covered}/${metricSummary.total}) is below ${threshold}%`,
        );
      } else if (threshold < 0) {
        const uncovered = metricSummary.total - metricSummary.covered;
        const maxUncovered = Math.abs(threshold);
        if (uncovered > maxUncovered) {
          failures.push(
            `${metric}: ${uncovered} uncovered items exceeds ${maxUncovered}`,
          );
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error('\nCoverage threshold failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

function printSummary(summary) {
  console.log('\nCoverage summary:');
  for (const metric of metrics) {
    const metricSummary = summary.total[metric];
    console.log(
      `${metric}: ${formatPercent(metricSummary.pct)} (${metricSummary.covered}/${metricSummary.total})`,
    );
  }
}

function readExpectedShardCount(value) {
  if (value === undefined) {
    return 0;
  }

  const expectedShardCount = Number(value);
  if (!Number.isInteger(expectedShardCount) || expectedShardCount < 1) {
    throw new Error(`Invalid expected shard count: ${value}`);
  }

  return expectedShardCount;
}

function main() {
  const inputDir = path.resolve(process.argv[2] || 'coverage-shards');
  const outputDir = path.resolve(process.argv[3] || 'coverage');
  const expectedShardCount = readExpectedShardCount(process.argv[4]);
  const coverageFiles = collectCoverageFiles(inputDir);

  if (coverageFiles.length === 0) {
    throw new Error(`No coverage-final.json files found in ${inputDir}`);
  }
  if (expectedShardCount > 0 && coverageFiles.length !== expectedShardCount) {
    throw new Error(
      `Expected ${expectedShardCount} coverage shard(s), found ${coverageFiles.length}`,
    );
  }

  const coverageMap = readCoverageMap(coverageFiles);
  const summary = summarizeCoverageMap(coverageMap);

  writeCoverageReports(coverageMap, summary, outputDir);
  printSummary(summary);
  checkCoverageThresholds(summary, readGlobalCoverageThreshold());

  console.log(
    `Merged ${coverageFiles.length} coverage shard(s) into ${outputDir}`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
