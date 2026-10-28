const BalancedTestSequencer = require('./balancedTestSequencer');

const { assignShards } = BalancedTestSequencer;

const durations = {
  'a.test.ts': 10,
  'b.test.ts': 9,
  'c.test.ts': 4,
  'd.test.ts': 3,
  'e.test.ts': 2,
  'f.test.ts': 2,
};
const recordedPaths = Object.keys(durations);
const totalOf = (shard) =>
  shard.reduce((sum, testPath) => sum + durations[testPath], 0);

describe('balancedTestSequencer', () => {
  it('puts every test, recorded or not, in exactly one shard', () => {
    const testPaths = [...recordedPaths, 'new.test.ts'];
    const shards = assignShards(testPaths, 3, durations);
    expect(shards).toHaveLength(3);
    expect(shards.flat().toSorted()).toEqual(testPaths.toSorted());
  });

  it('balances recorded durations across shards', () => {
    const totals = assignShards(recordedPaths, 2, durations).map(totalOf);
    expect(totals).toEqual([15, 15]);
  });

  it('assigns the same shards whatever order Jest lists the tests in', () => {
    expect(assignShards(recordedPaths.toReversed(), 3, durations)).toEqual(
      assignShards(recordedPaths, 3, durations),
    );
  });

  it('spreads tests without any recorded duration evenly', () => {
    const shards = assignShards(
      ['w.test.ts', 'x.test.ts', 'y.test.ts', 'z.test.ts'],
      2,
      {},
    );
    expect(shards.map((shard) => shard.length)).toEqual([2, 2]);
  });

  it('returns the 1-based shard Jest asks for, keyed by repo-relative path', () => {
    const rootDir = '/repo';
    const tests = ['packages/a.test.ts', 'packages/b.test.ts'].map(
      (testPath) => ({
        path: `${rootDir}/${testPath}`,
        context: { config: { rootDir } },
      }),
    );
    const sequencer = new BalancedTestSequencer();
    const first = sequencer.shard(tests, { shardIndex: 1, shardCount: 2 });
    const second = sequencer.shard(tests, { shardIndex: 2, shardCount: 2 });
    expect([...first, ...second].map((test) => test.path).toSorted()).toEqual(
      tests.map((test) => test.path),
    );
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });
});
