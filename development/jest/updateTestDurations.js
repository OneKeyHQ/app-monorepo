// Rebuilds testDurations.json from the HTML reports of a unit test CI run:
//   gh run download <run-id> --pattern 'test-report-*' --dir <dir>
//   node development/jest/updateTestDurations.js <dir>
const fs = require('node:fs');
const path = require('node:path');

const SUITE_PATTERN =
  /<div class="suite-path">([^<]+)<\/div><div class="suite-time[^"]*">([\d.]+)s<\/div>/g;
// The reports hold absolute paths inside the GitHub-hosted runner checkout.
const CHECKOUT_PREFIX = /^\/home\/runner\/work\/[^/]+\/[^/]+\//;

function comparePaths(a, b) {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

function main() {
  const [reportDirectory] = process.argv.slice(2);
  if (!reportDirectory) {
    console.error(
      'Usage: node development/jest/updateTestDurations.js <report-dir>',
    );
    process.exit(1);
  }
  const reports = fs
    .readdirSync(reportDirectory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === 'test-report.html')
    .map((entry) => path.join(entry.parentPath, entry.name));
  const durations = {};
  for (const report of reports) {
    const html = fs.readFileSync(report, 'utf8');
    for (const [, suitePath, seconds] of html.matchAll(SUITE_PATTERN)) {
      const testPath = suitePath.replace(CHECKOUT_PREFIX, '');
      if (testPath !== suitePath) {
        durations[testPath] = Math.round(Number(seconds) * 100) / 100;
      }
    }
  }
  const testPaths = Object.keys(durations).toSorted(comparePaths);
  if (testPaths.length === 0) {
    console.error(`No test durations found in ${reports.length} report(s).`);
    process.exit(1);
  }
  const sorted = Object.fromEntries(
    testPaths.map((testPath) => [testPath, durations[testPath]]),
  );
  fs.writeFileSync(
    path.join(__dirname, 'testDurations.json'),
    `${JSON.stringify(sorted, null, 2)}\n`,
  );
  console.log(
    `Recorded ${testPaths.length} test files from ${reports.length} report(s).`,
  );
}

main();
