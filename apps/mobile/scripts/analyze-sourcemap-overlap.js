/**
 * Sourcemap overlap analysis script (Phase 0)
 *
 * Compares main and background bundle sourcemaps to measure:
 * - Total source count per bundle
 * - Intersection (shared sources)
 * - Sources unique to each bundle
 * - Overlap percentage
 *
 * Usage:
 *   node scripts/analyze-sourcemap-overlap.js <mainMapPath> <backgroundMapPath>
 *
 * Example:
 *   node scripts/analyze-sourcemap-overlap.js \
 *     out-dir-bundle/ios/main.jsbundle.map \
 *     out-dir-bundle/ios/background.bundle.map
 *
 * If no arguments are provided, attempts to read from the default build output paths.
 */

const path = require('path');

const fs = require('fs-extra');

const mobileDirPath = path.resolve(__dirname, '..');
const defaultMainMap = path.join(
  mobileDirPath,
  'out-dir-bundle/ios/main.jsbundle.map',
);
const defaultBgMap = path.join(
  mobileDirPath,
  'out-dir-bundle/ios/background.bundle.map',
);

function loadSources(mapPath) {
  if (!fs.existsSync(mapPath)) {
    console.error(`Sourcemap not found: ${mapPath}`);
    process.exit(1);
  }
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const sources = (map.sources || []).map((s) =>
    s.replace(/^\//, '').replace(/\?.*$/, ''),
  );
  return new Set(sources);
}

function categorize(sources) {
  const categories = {
    services: 0,
    vaults: 0,
    components: 0,
    kit: 0,
    kitBg: 0,
    shared: 0,
    nodeModules: 0,
    other: 0,
  };

  for (const s of sources) {
    if (s.includes('node_modules/') || s.includes('node_modules\\')) {
      categories.nodeModules += 1;
    } else if (s.includes('kit-bg/src/services/')) {
      categories.services += 1;
    } else if (s.includes('kit-bg/src/vaults/')) {
      categories.vaults += 1;
    } else if (s.includes('packages/components/')) {
      categories.components += 1;
    } else if (s.includes('packages/kit/')) {
      categories.kit += 1;
    } else if (s.includes('packages/kit-bg/')) {
      categories.kitBg += 1;
    } else if (s.includes('packages/shared/')) {
      categories.shared += 1;
    } else {
      categories.other += 1;
    }
  }

  return categories;
}

function main() {
  const mainMapPath = process.argv[2] || defaultMainMap;
  const bgMapPath = process.argv[3] || defaultBgMap;

  console.log('=== Sourcemap Overlap Analysis ===\n');
  console.log(`Main map:       ${mainMapPath}`);
  console.log(`Background map: ${bgMapPath}\n`);

  const mainSources = loadSources(mainMapPath);
  const bgSources = loadSources(bgMapPath);

  const intersection = new Set(
    [...mainSources].filter((s) => bgSources.has(s)),
  );
  const mainOnly = new Set([...mainSources].filter((s) => !bgSources.has(s)));
  const bgOnly = new Set([...bgSources].filter((s) => !mainSources.has(s)));

  console.log('--- Source Counts ---');
  console.log(`Main sources:       ${mainSources.size}`);
  console.log(`Background sources: ${bgSources.size}`);
  console.log(`Intersection:       ${intersection.size}`);
  console.log(`Main-only:          ${mainOnly.size}`);
  console.log(`Background-only:    ${bgOnly.size}`);
  console.log(
    `BG overlap:         ${((intersection.size / bgSources.size) * 100).toFixed(1)}% of background is also in main`,
  );
  console.log(
    `Main overlap:       ${((intersection.size / mainSources.size) * 100).toFixed(1)}% of main is also in background`,
  );

  console.log('\n--- Category Breakdown (Intersection) ---');
  const intCat = categorize(intersection);
  Object.entries(intCat).forEach(([k, v]) => {
    if (v > 0) console.log(`  ${k}: ${v}`);
  });

  console.log('\n--- Category Breakdown (Main-only) ---');
  const mainCat = categorize(mainOnly);
  Object.entries(mainCat).forEach(([k, v]) => {
    if (v > 0) console.log(`  ${k}: ${v}`);
  });

  console.log('\n--- Category Breakdown (Background-only) ---');
  const bgCat = categorize(bgOnly);
  Object.entries(bgCat).forEach(([k, v]) => {
    if (v > 0) console.log(`  ${k}: ${v}`);
  });

  // Write detailed lists
  const outDir = path.join(mobileDirPath, 'out-dir-analysis');
  fs.ensureDirSync(outDir);

  fs.writeFileSync(
    path.join(outDir, 'intersection.txt'),
    [...intersection].toSorted().join('\n'),
  );
  fs.writeFileSync(
    path.join(outDir, 'main-only.txt'),
    [...mainOnly].toSorted().join('\n'),
  );
  fs.writeFileSync(
    path.join(outDir, 'bg-only.txt'),
    [...bgOnly].toSorted().join('\n'),
  );
  console.log(`\nDetailed lists written to: ${outDir}`);

  // Output JSON for CI consumption
  const report = {
    mainSources: mainSources.size,
    backgroundSources: bgSources.size,
    intersection: intersection.size,
    mainOnly: mainOnly.size,
    backgroundOnly: bgOnly.size,
    bgOverlapPercent: Number(
      ((intersection.size / bgSources.size) * 100).toFixed(1),
    ),
    categories: { intersection: intCat, mainOnly: mainCat, bgOnly: bgCat },
  };
  const reportPath = path.join(outDir, 'overlap-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`JSON report: ${reportPath}`);
}

main();
