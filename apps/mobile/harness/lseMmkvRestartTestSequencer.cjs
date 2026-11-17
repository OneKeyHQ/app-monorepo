const TestSequencer = require('@jest/test-sequencer').default;

const phaseByFileName = new Map([
  ['local-secret-envelope-mmkv-restart.write.harness.ts', 0],
  ['local-secret-envelope-mmkv-restart.read.harness.ts', 1],
]);

module.exports = class LseMmkvRestartTestSequencer extends TestSequencer {
  sort(tests) {
    return [...tests].toSorted((left, right) => {
      const leftPhase = phaseByFileName.get(left.path.split('/').at(-1)) ?? 2;
      const rightPhase = phaseByFileName.get(right.path.split('/').at(-1)) ?? 2;
      return leftPhase - rightPhase || left.path.localeCompare(right.path);
    });
  }
};
