// Jest's built-in --shard splits test files by path hash, so slow suites can
// pile up in one shard and hold up the whole CI run. Assign them by the
// durations recorded from CI instead (see updateTestDurations.js).
const path = require('node:path');

const Sequencer = require('@jest/test-sequencer').default;

const recordedDurations = require('./testDurations.json');

function comparePaths(a, b) {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

function median(values) {
  if (values.length === 0) {
    return 1;
  }
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Longest first, each onto the lightest shard. Ties break by path so every
// shard process computes the same assignment.
function assignShards(testPaths, shardCount, durations = recordedDurations) {
  const fallback = median(Object.values(durations));
  const tests = testPaths
    .map((testPath) => ({ testPath, cost: durations[testPath] ?? fallback }))
    .toSorted(
      (a, b) => b.cost - a.cost || comparePaths(a.testPath, b.testPath),
    );
  const shards = Array.from({ length: shardCount }, () => ({
    total: 0,
    testPaths: [],
  }));
  for (const { testPath, cost } of tests) {
    const lightest = shards.reduce((min, shard) =>
      shard.total < min.total ? shard : min,
    );
    lightest.total += cost;
    lightest.testPaths.push(testPath);
  }
  return shards.map((shard) => shard.testPaths);
}

class BalancedTestSequencer extends Sequencer {
  shard(tests, { shardIndex, shardCount }) {
    const keyOf = (test) =>
      path
        .relative(test.context.config.rootDir, test.path)
        .split(path.sep)
        .join('/');
    const selected = new Set(
      assignShards(tests.map(keyOf), shardCount)[shardIndex - 1],
    );
    return tests.filter((test) => selected.has(keyOf(test)));
  }
}

module.exports = BalancedTestSequencer;
module.exports.assignShards = assignShards;
