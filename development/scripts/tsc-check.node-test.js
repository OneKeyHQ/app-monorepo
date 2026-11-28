/* cspell:words GOMEMLIMIT GOGC */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  DEFAULT_CHECKERS,
  DEFAULT_GOGC,
  DEFAULT_GOMEMLIMIT,
  buildTscInvocation,
} = require('./tsc-check');

test('buildTscInvocation applies default memory limits and checker cap', () => {
  const invocation = buildTscInvocation({
    cacheFolder: '/tmp/yarn-cache',
    env: {},
  });

  assert.equal(invocation.command, process.execPath);
  assert.equal(invocation.env.GOMEMLIMIT, DEFAULT_GOMEMLIMIT);
  assert.equal(invocation.env.GOGC, DEFAULT_GOGC);

  const checkersIdx = invocation.args.indexOf('--checkers');
  assert.notEqual(checkersIdx, -1);
  assert.equal(invocation.args[checkersIdx + 1], DEFAULT_CHECKERS);

  const buildInfoIdx = invocation.args.indexOf('--tsBuildInfoFile');
  assert.notEqual(buildInfoIdx, -1);
  assert.equal(
    invocation.args[buildInfoIdx + 1],
    path.join('/tmp/yarn-cache', '.app-mono-ts-cache'),
  );
  assert.ok(invocation.args.includes('--pretty'));
});

test('buildTscInvocation respects environment overrides and extra args', () => {
  const invocation = buildTscInvocation({
    cacheFolder: '/tmp/yarn-cache',
    extraArgs: ['--extendedDiagnostics'],
    env: {
      GOMEMLIMIT: '10GiB',
      GOGC: '80',
      ONEKEY_TSC_CHECKERS: '1',
    },
  });

  assert.equal(invocation.env.GOMEMLIMIT, '10GiB');
  assert.equal(invocation.env.GOGC, '80');
  const checkersIdx = invocation.args.indexOf('--checkers');
  assert.equal(invocation.args[checkersIdx + 1], '1');
  assert.ok(invocation.args.includes('--extendedDiagnostics'));
});
