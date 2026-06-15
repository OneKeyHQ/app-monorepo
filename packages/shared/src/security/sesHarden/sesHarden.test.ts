// cspell:ignore lockdown Agentation
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

import { buildSesRuntimeCheckReport } from './runtimeCheck';

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

test('ignores legacy runtime level override channels', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const originalGlobalLevel = g.__ONEKEY_SES_HARDEN_LEVEL__;
  const originalLocation = g.location;
  const originalLocalStorage = g.localStorage;
  const originalSesEnv = process.env.ONEKEY_SES_HARDEN_LEVEL;
  const originalAppSesEnv = process.env.ONEKEY_APP_SES_HARDEN_LEVEL;
  const overrideLevel = ONEKEY_SES_HARDEN_DEFAULT_LEVEL === 'L2' ? 'L1' : 'L2';

  g.__ONEKEY_SES_HARDEN_LEVEL__ = overrideLevel;
  g.location = {
    search: `?onekeySesHardenLevel=${overrideLevel}`,
  };
  g.localStorage = {
    getItem: () => overrideLevel,
  };
  process.env.ONEKEY_SES_HARDEN_LEVEL = overrideLevel;
  process.env.ONEKEY_APP_SES_HARDEN_LEVEL = overrideLevel;

  try {
    expect(getSesHardenLevelFromRuntime()).toBe(
      ONEKEY_SES_HARDEN_DEFAULT_LEVEL,
    );
  } finally {
    if (originalGlobalLevel === undefined) {
      Reflect.deleteProperty(g, '__ONEKEY_SES_HARDEN_LEVEL__');
    } else {
      g.__ONEKEY_SES_HARDEN_LEVEL__ = originalGlobalLevel;
    }
    if (originalLocation === undefined) {
      Reflect.deleteProperty(g, 'location');
    } else {
      g.location = originalLocation;
    }
    if (originalLocalStorage === undefined) {
      Reflect.deleteProperty(g, 'localStorage');
    } else {
      g.localStorage = originalLocalStorage;
    }
    if (originalSesEnv === undefined) {
      Reflect.deleteProperty(process.env, 'ONEKEY_SES_HARDEN_LEVEL');
    } else {
      process.env.ONEKEY_SES_HARDEN_LEVEL = originalSesEnv;
    }
    if (originalAppSesEnv === undefined) {
      Reflect.deleteProperty(process.env, 'ONEKEY_APP_SES_HARDEN_LEVEL');
    } else {
      process.env.ONEKEY_APP_SES_HARDEN_LEVEL = originalAppSesEnv;
    }
  }
});

test('uses unsafe eval in L1 while applying loose lockdown options', () => {
  const lockdown = jest.fn();

  const state = maybeLockdownOneKeyRuntime({
    runtime: 'desktop-renderer',
    level: 'L1',
    lockdown,
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

test('forces no-eval for every extension runtime regardless of level', () => {
  const extRuntimes = [
    'ext-ui',
    'ext-background',
    'ext-offscreen',
    'ext-passkey',
  ] as const;

  for (const runtime of extRuntimes) {
    // The extension CSP (script-src 'self' 'wasm-unsafe-eval') forbids host
    // eval, so both unsafe-eval (L1) and safe-eval (L2) must collapse to
    // no-eval to avoid a CSP EvalError at lockdown() time.
    expect(getSesLockdownOptions('L1', runtime)?.evalTaming).toBe('no-eval');
    expect(getSesLockdownOptions('L2', runtime)?.evalTaming).toBe('no-eval');
    // Non-eval taming dimensions stay aligned with the loose defaults.
    expect(getSesLockdownOptions('L2', runtime)).toEqual({
      ...getSesLockdownOptions('L2'),
      evalTaming: 'no-eval',
    });
    // L0 stays a true no-lockdown path even for extension runtimes.
    expect(getSesLockdownOptions('L0', runtime)).toBeUndefined();
  }
});

test('does not change eval taming for web or desktop runtimes', () => {
  expect(getSesLockdownOptions('L1', 'web')?.evalTaming).toBe('unsafe-eval');
  expect(getSesLockdownOptions('L2', 'web')?.evalTaming).toBe('safe-eval');
  expect(getSesLockdownOptions('L1', 'desktop-renderer')?.evalTaming).toBe(
    'unsafe-eval',
  );
  expect(getSesLockdownOptions('L2', 'desktop-renderer')?.evalTaming).toBe(
    'safe-eval',
  );
});

test('threads runtime into lockdown options so ext locks down with no-eval', () => {
  const lockdown = jest.fn();

  const state = maybeLockdownOneKeyRuntime({
    runtime: 'ext-background',
    level: 'L2',
    lockdown,
  });

  expect(lockdown).toHaveBeenCalledWith(
    expect.objectContaining({ evalTaming: 'no-eval' }),
  );
  expect(state).toMatchObject({
    runtime: 'ext-background',
    lockdownApplied: true,
    evalTaming: 'no-eval',
  });
});

test('does not load SES when L0 is selected', () => {
  const loadSes = jest.fn();

  maybeLockdownOneKeyRuntime({
    runtime: 'ext-ui',
    level: 'L0',
    loadSes,
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

test('installs post-lockdown patch warning monitor in production', () => {
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
    });

    // The monitor is install-once + only-on-violation, so it is safe to keep
    // enabled in production to retain diagnostics there.
    expect(g.addEventListener).toHaveBeenCalled();
    expect(g.__ONEKEY_SES_HARDEN_PATCH_WARNING_MONITOR_INSTALLED__).toBe(true);
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

test('emits each post-lockdown patch warning fingerprint only once', () => {
  const g = globalThis as unknown as ISesHardenGlobal;
  const originalAddEventListener = g.addEventListener;
  const listeners = new Map<string, EventListenerOrEventListenerObject>();
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

  g.addEventListener = jest.fn((type, listener) => {
    listeners.set(type, listener);
  }) as typeof globalThis.addEventListener;

  try {
    maybeLockdownOneKeyRuntime({
      runtime: 'web',
      level: 'L1',
      lockdown: jest.fn(),
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

    const dispatch = () => {
      if (typeof listener === 'function') {
        listener(event);
      } else {
        listener?.handleEvent(event);
      }
    };

    dispatch();
    dispatch();
    dispatch();

    // Recorded count keeps incrementing (dedup updates lastSeenAt/count)...
    expect(getSesHardenPatchWarnings()).toEqual([
      expect.objectContaining({ count: 3 }),
    ]);
    // ...but the console is only warned once per unique fingerprint per session.
    const patchWarnCalls = warnSpy.mock.calls.filter(
      ([message]) =>
        message === '[OneKey SES Harden] Post-lockdown patch attempt detected',
    );
    expect(patchWarnCalls).toHaveLength(1);
  } finally {
    if (originalAddEventListener) {
      g.addEventListener = originalAddEventListener;
    } else {
      delete g.addEventListener;
    }
    warnSpy.mockRestore();
  }
});

test('accepts legacy timer interceptor wrappers without marker', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalSetInterval = globalThis.setInterval;

  const legacySetTimeout = function legacyOneKeyTimerInterceptor(
    fn: (...args: unknown[]) => unknown,
    timeout?: number,
    ...args: unknown[]
  ) {
    if (Reflect.get(globalThis, '$$onekeyDisabledSetTimeout')) {
      return undefined;
    }
    return originalSetTimeout(() => fn(...args), timeout);
  };
  const legacySetInterval = function legacyOneKeyTimerInterceptor(
    fn: (...args: unknown[]) => unknown,
    timeout?: number,
    ...args: unknown[]
  ) {
    if (Reflect.get(globalThis, '$$onekeyDisabledSetInterval')) {
      return undefined;
    }
    return originalSetInterval(() => fn(...args), timeout);
  };

  globalThis.setTimeout = legacySetTimeout as typeof globalThis.setTimeout;
  globalThis.setInterval = legacySetInterval as typeof globalThis.setInterval;

  try {
    const report = await buildSesRuntimeCheckReport();
    const timerCheck = report.checks.find(
      (check) => check.name === 'timer interceptor',
    );
    const detail = JSON.parse(timerCheck?.detail ?? '{}') as {
      setTimeout?: {
        behavior: {
          disabledFlagBlocksCallbacks: boolean;
        };
        marker: unknown;
        sourceLooksOneKeyIntercepted: boolean;
        installed: boolean;
      };
      setInterval?: {
        behavior: {
          disabledFlagBlocksCallbacks: boolean;
        };
        marker: unknown;
        sourceLooksOneKeyIntercepted: boolean;
        installed: boolean;
      };
    };

    expect(timerCheck?.status).toBe('pass');
    expect(detail.setTimeout).toMatchObject({
      marker: null,
      sourceLooksOneKeyIntercepted: true,
      installed: true,
      behavior: {
        disabledFlagBlocksCallbacks: true,
      },
    });
    expect(detail.setInterval).toMatchObject({
      marker: null,
      sourceLooksOneKeyIntercepted: true,
      installed: true,
      behavior: {
        disabledFlagBlocksCallbacks: true,
      },
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
  }
});

test('accepts agentation timer wrappers when OneKey wrapper remains in the chain', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalSetInterval = globalThis.setInterval;

  const oneKeySetTimeout = function oneKeyTimerInterceptor(
    fn: (...args: unknown[]) => unknown,
    timeout?: number,
    ...args: unknown[]
  ) {
    return originalSetTimeout(() => {
      if (Reflect.get(globalThis, '$$onekeyDisabledSetTimeout')) {
        return;
      }
      fn(...args);
    }, timeout);
  };
  const oneKeySetInterval = function oneKeyTimerInterceptor(
    fn: (...args: unknown[]) => unknown,
    timeout?: number,
    ...args: unknown[]
  ) {
    return originalSetInterval(() => {
      if (Reflect.get(globalThis, '$$onekeyDisabledSetInterval')) {
        return;
      }
      fn(...args);
    }, timeout);
  };

  const _s = {
    frozen: false,
    frozenTimeoutQueue: [] as Array<() => void>,
    origSetInterval: oneKeySetInterval,
    origSetTimeout: oneKeySetTimeout,
  };

  const agentationSetTimeout = function agentationSetTimeout(
    handler: (...args: unknown[]) => unknown,
    timeout?: number,
    ...args: unknown[]
  ) {
    return _s.origSetTimeout(
      (...a: unknown[]) => {
        if (_s.frozen) {
          _s.frozenTimeoutQueue.push(() => handler(...a));
        } else {
          handler(...a);
        }
      },
      timeout,
      ...args,
    );
  };
  const agentationSetInterval = function agentationSetInterval(
    handler: (...args: unknown[]) => unknown,
    timeout?: number,
    ...args: unknown[]
  ) {
    return _s.origSetInterval(
      (...a: unknown[]) => {
        if (!_s.frozen) handler(...a);
      },
      timeout,
      ...args,
    );
  };

  globalThis.setTimeout = agentationSetTimeout as typeof globalThis.setTimeout;
  globalThis.setInterval =
    agentationSetInterval as typeof globalThis.setInterval;

  try {
    const report = await buildSesRuntimeCheckReport();
    const timerCheck = report.checks.find(
      (check) => check.name === 'timer interceptor',
    );
    const detail = JSON.parse(timerCheck?.detail ?? '{}') as {
      setTimeout?: {
        behavior: {
          disabledFlagBlocksCallbacks: boolean;
          enabledCallbackRan: boolean;
        };
        sourceLooksAgentationWrapped: boolean;
      };
      setInterval?: {
        behavior: {
          disabledFlagBlocksCallbacks: boolean;
          enabledCallbackRan: boolean;
        };
        sourceLooksAgentationWrapped: boolean;
      };
    };

    expect(timerCheck?.status).toBe('pass');
    expect(detail.setTimeout).toMatchObject({
      behavior: {
        disabledFlagBlocksCallbacks: true,
        enabledCallbackRan: true,
      },
      sourceLooksAgentationWrapped: true,
    });
    expect(detail.setInterval).toMatchObject({
      behavior: {
        disabledFlagBlocksCallbacks: true,
        enabledCallbackRan: true,
      },
      sourceLooksAgentationWrapped: true,
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
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
