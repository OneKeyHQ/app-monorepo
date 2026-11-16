import { webcrypto } from 'node:crypto';

import {
  assertSesBehavior,
  checkSesBehavior,
  runSesCryptoChecks,
  runSesLanguageChecks,
} from './runtimeCheckBehavior';
import { runSesIntrinsicBehaviorChecks } from './runtimeCheckIntrinsicBehavior';

test('language probes assert actual Promise and binary behavior', async () => {
  const checks = [
    ...(await runSesLanguageChecks()),
    ...(await runSesIntrinsicBehaviorChecks()),
  ];
  expect(checks).toHaveLength(9);
  expect(checks.filter((check) => check.status !== 'pass')).toEqual([]);
});

test('crypto dispatchers match public vectors and reject a corrupted GCM tag', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    const checks = await runSesCryptoChecks();
    expect(checks).toHaveLength(4);
    expect(checks.filter((check) => check.status !== 'pass')).toEqual([]);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
  }
});

test('a failed assertion and an async rejection are reported as failures', async () => {
  expect(
    await checkSesBehavior('bad vector', 'fixture', () => {
      assertSesBehavior(false, 'vector mismatch');
      return 'unreachable';
    }),
  ).toMatchObject({ status: 'fail', detail: 'vector mismatch' });
  expect(
    await checkSesBehavior('rejected backend', 'fixture', () =>
      Promise.reject(new Error('backend failed')),
    ),
  ).toMatchObject({ status: 'fail', detail: 'backend failed' });
});
