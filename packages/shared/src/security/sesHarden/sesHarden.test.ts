// cspell:ignore lockdown
import { execFileSync } from 'node:child_process';

import {
  ONEKEY_SES_HARDEN_DEFAULT_LEVEL,
  getConfiguredSesHardenLevel,
  getSesHarden,
  getSesHardenLevelFromRuntime,
  getSesHardenPatchWarnings,
  getSesLockdownOptions,
  maybeLockdownOneKeyRuntime,
  normalizeSesHardenLevel,
  resetSesHardenRuntimeStateForTest,
} from '.';

import type { ISesHardenGlobal } from './types';

function runSesLockdownInChild(level: 'L1' | 'L2') {
  const lockdownOptions = getSesLockdownOptions(level);
  const source = `
const options = JSON.parse(process.argv[1]);
require('ses');
lockdown(options);
const result = {
  objectPrototypeFrozen: Object.isFrozen(Object.prototype),
  arrayPrototypeFrozen: Object.isFrozen(Array.prototype),
  hardenType: typeof harden,
  evalTaming: options.evalTaming,
  evalResult: eval('1 + 2'),
  functionResult: Function('return 4')(),
  functionThisIsGlobal: Function('return this')() === globalThis,
};
process.stdout.write(JSON.stringify(result));
`;
  return JSON.parse(
    execFileSync(process.execPath, [
      '-e',
      source,
      JSON.stringify(lockdownOptions),
    ]).toString(),
  ) as {
    objectPrototypeFrozen: boolean;
    arrayPrototypeFrozen: boolean;
    hardenType: string;
    evalTaming: string;
    evalResult: number;
    functionResult: number;
    functionThisIsGlobal: boolean;
  };
}

beforeEach(() => {
  resetSesHardenRuntimeStateForTest();
});

test('normalizes supported harden levels', () => {
  expect(normalizeSesHardenLevel('l0')).toBe('L0');
  expect(normalizeSesHardenLevel(' L1 ')).toBe('L1');
  expect(normalizeSesHardenLevel('L2')).toBe('L2');
  expect(normalizeSesHardenLevel('L3')).toBeUndefined();
  expect(normalizeSesHardenLevel(undefined)).toBeUndefined();
});

test('keeps L0 as no-lockdown', () => {
  const state = maybeLockdownOneKeyRuntime({
    runtime: 'web',
    level: 'L0',
    loadSes: jest.fn(),
    lockdown: jest.fn(),
    installSwitch: false,
  });

  expect(state).toEqual({
    level: 'L0',
    runtime: 'web',
    lockdownApplied: false,
    objectPrototypeFrozen: Object.isFrozen(Object.prototype),
    reason: 'level-disabled',
  });
});

test('uses synchronous const config as the default level', () => {
  expect(getConfiguredSesHardenLevel('ext-background')).toBe(
    ONEKEY_SES_HARDEN_DEFAULT_LEVEL,
  );
  expect(getSesHardenLevelFromRuntime('ext-background')).toBe(
    ONEKEY_SES_HARDEN_DEFAULT_LEVEL,
  );
});

test('uses unsafe eval in L1 while applying loose lockdown options', () => {
  const lockdown = jest.fn();

  const state = maybeLockdownOneKeyRuntime({
    runtime: 'desktop-renderer',
    level: 'L1',
    lockdown,
    installSwitch: false,
  });

  expect(lockdown).toHaveBeenCalledWith({
    errorTaming: 'unsafe-debug',
    errorTrapping: 'none',
    reporting: 'console',
    unhandledRejectionTrapping: 'none',
    regExpTaming: 'unsafe',
    localeTaming: 'unsafe',
    consoleTaming: 'unsafe',
    overrideTaming: 'moderate',
    stackFiltering: 'verbose',
    domainTaming: 'safe',
    evalTaming: 'unsafe-eval',
    legacyRegeneratorRuntimeTaming: 'safe',
  });
  expect(state).toMatchObject({
    level: 'L1',
    runtime: 'desktop-renderer',
    lockdownApplied: true,
    evalTaming: 'unsafe-eval',
  });
});

test('only changes eval taming in L2', () => {
  const l1Options = getSesLockdownOptions('L1');
  const l2Options = getSesLockdownOptions('L2');

  expect(l1Options).toEqual({
    ...l2Options,
    evalTaming: 'unsafe-eval',
  });
  expect(l2Options?.evalTaming).toBe('safe-eval');
});

test('does not load SES when L0 is selected', () => {
  const loadSes = jest.fn();

  maybeLockdownOneKeyRuntime({
    runtime: 'ext-ui',
    level: 'L0',
    loadSes,
    installSwitch: false,
  });

  expect(loadSes).not.toHaveBeenCalled();
});

test('records post-lockdown patch warning errors', () => {
  const g = globalThis as unknown as ISesHardenGlobal;
  const originalAddEventListener = g.addEventListener;
  const originalNodeEnv = process.env.NODE_ENV;
  const listeners = new Map<string, EventListenerOrEventListenerObject>();
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

  process.env.NODE_ENV = 'test';
  g.addEventListener = jest.fn((type, listener) => {
    listeners.set(type, listener);
  }) as typeof globalThis.addEventListener;

  try {
    maybeLockdownOneKeyRuntime({
      runtime: 'web',
      level: 'L1',
      lockdown: jest.fn(),
      installSwitch: false,
    });

    const listener = listeners.get('error');
    expect(listener).toBeDefined();

    const event = {
      error: new TypeError(
        "Cannot assign to read only property 'push' of object '[object Array]'",
      ),
      filename: 'app.js',
      lineno: 10,
      colno: 20,
    } as unknown as Event;

    if (typeof listener === 'function') {
      listener(event);
      listener(event);
    } else {
      listener?.handleEvent(event);
      listener?.handleEvent(event);
    }

    expect(getSesHardenPatchWarnings()).toEqual([
      expect.objectContaining({
        id: 1,
        lastSeenAt: expect.any(String),
        level: 'L1',
        runtime: 'web',
        kind: 'error',
        fingerprint: expect.any(String),
        count: 2,
        message:
          "Cannot assign to read only property 'push' of object '[object Array]'",
        source: 'app.js',
        lineno: 10,
        colno: 20,
      }),
    ]);
    expect(g.__ONEKEY_SES_HARDEN_PATCH_WARNING_COUNT__).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      '[OneKey SES Harden] Post-lockdown patch attempt detected',
      expect.any(Object),
    );
  } finally {
    if (originalAddEventListener) {
      g.addEventListener = originalAddEventListener;
    } else {
      delete g.addEventListener;
    }
    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, 'NODE_ENV');
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    warnSpy.mockRestore();
  }
});

test('does not install post-lockdown patch warning monitor in production', () => {
  const g = globalThis as unknown as ISesHardenGlobal;
  const originalAddEventListener = g.addEventListener;
  const originalNodeEnv = process.env.NODE_ENV;

  process.env.NODE_ENV = 'production';
  g.addEventListener = jest.fn() as typeof globalThis.addEventListener;

  try {
    maybeLockdownOneKeyRuntime({
      runtime: 'web',
      level: 'L1',
      lockdown: jest.fn(),
      installSwitch: false,
    });

    expect(g.addEventListener).not.toHaveBeenCalled();
    expect(
      g.__ONEKEY_SES_HARDEN_PATCH_WARNING_MONITOR_INSTALLED__,
    ).toBeUndefined();
    expect(getSesHardenPatchWarnings()).toEqual([]);
  } finally {
    if (originalAddEventListener) {
      g.addEventListener = originalAddEventListener;
    } else {
      delete g.addEventListener;
    }
    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, 'NODE_ENV');
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test('returns the SES-provided harden function without wrapping it', () => {
  const g = globalThis as unknown as {
    harden?: <T>(value: T) => T;
  };
  const harden = jest.fn(<T>(value: T) => value);

  g.harden = harden;

  expect(getSesHarden()).toBe(harden);

  delete g.harden;
});

test('runs real SES lockdown in an isolated child process for L1', () => {
  const result = runSesLockdownInChild('L1');

  expect(result).toEqual({
    objectPrototypeFrozen: true,
    arrayPrototypeFrozen: true,
    hardenType: 'function',
    evalTaming: 'unsafe-eval',
    evalResult: 3,
    functionResult: 4,
    functionThisIsGlobal: true,
  });
});

test('runs real SES lockdown in an isolated child process for L2', () => {
  const result = runSesLockdownInChild('L2');

  expect(result).toEqual({
    objectPrototypeFrozen: true,
    arrayPrototypeFrozen: true,
    hardenType: 'function',
    evalTaming: 'safe-eval',
    evalResult: 3,
    functionResult: 4,
    functionThisIsGlobal: false,
  });
});
