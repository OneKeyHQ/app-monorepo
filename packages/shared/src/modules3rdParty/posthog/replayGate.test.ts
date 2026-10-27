import { OneKeyLocalError } from '../../errors';

import type { IReplayControllerExtensions } from './replayGate';
import type { IReplayController, IReplayGateStatus } from './replayTypes';

const mockSetReplayContext = jest.fn<void, [unknown]>();

jest.mock('../../analytics', () => ({
  analytics: {
    setReplayContext: (context: unknown) => {
      mockSetReplayContext(context);
    },
  },
}));

type IGateModule = typeof import('./replayGate');

// Bucket 8559 (unsampled at 300), bucket 0 (sampled at any threshold > 0).
const UNSAMPLED_SID = '01890a5d-ac96-774b-bcce-0000deadbeef';
const SAMPLED_SID = '01890a5d-ac96-774b-bcce-000000000000';
const SAMPLED_SID_2 = '01890a5d-ac96-774b-bcce-000000000001';

const NOW = 1_700_000_000_000;

type IDeferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function deferred(): IDeferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function createController(sessionId: string | undefined = SAMPLED_SID) {
  const calls: string[] = [];
  let currentSessionId = sessionId;
  let nextTouchSessionId: string | undefined;
  let activeAfterStart = true;
  let startGate: IDeferred | undefined;
  let prepareGate: IDeferred | undefined;
  let stopFailures = 0;

  const controller: IReplayController & IReplayControllerExtensions = {
    platform: 'ios',
    getSessionId: () => currentSessionId,
    touchSession: jest.fn(async () => {
      calls.push('touch');
      if (nextTouchSessionId) {
        currentSessionId = nextTouchSessionId;
        nextTouchSessionId = undefined;
      }
      return currentSessionId;
    }),
    prepare: jest.fn(async () => {
      calls.push('prepare');
      if (prepareGate) {
        await prepareGate.promise;
      }
    }),
    start: jest.fn(async () => {
      calls.push('start');
      if (startGate) {
        await startGate.promise;
      }
    }),
    stop: jest.fn(async () => {
      calls.push('stop');
      if (stopFailures > 0) {
        stopFailures -= 1;
        throw new OneKeyLocalError('stop failed');
      }
    }),
    isRecordingActive: jest.fn(async () => activeAfterStart),
  };

  return {
    controller,
    calls,
    count: (name: string) => calls.filter((call) => call === name).length,
    setNextTouchSessionId: (id: string) => {
      nextTouchSessionId = id;
    },
    setActiveAfterStart: (value: boolean) => {
      activeAfterStart = value;
    },
    holdStart: () => {
      startGate = deferred();
      return startGate;
    },
    holdPrepare: () => {
      prepareGate = deferred();
      return prepareGate;
    },
    failNextStops: (times: number) => {
      stopFailures = times;
    },
  };
}

describe('replayGate', () => {
  let gate: IGateModule;

  async function flush(ms = 0) {
    await jest.advanceTimersByTimeAsync(ms);
  }

  // One frame (setTimeout fallback without rAF) plus the resume delay.
  async function flushResume() {
    await flush(gate.REPLAY_RESUME_DELAY_MS + 10);
  }

  function registerSampled(
    mock = createController(),
    { threshold = 300, forced = false } = {},
  ) {
    gate.registerReplayController({
      controller: mock.controller,
      threshold,
      forced,
    });
    return mock;
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    jest.resetModules();
    mockSetReplayContext.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    gate = require('./replayGate') as IGateModule;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is a no-op without a controller', async () => {
    const release = gate.acquireReplayPause('sensitive');
    gate.setReplayRouteAllowed(true, 'tab.market');
    gate.setReplayCondition('locked', true);
    gate.notifyReplayActivity();
    release();
    await flushResume();

    const status = gate.getReplayGateStatus();
    expect(status.hasController).toBe(false);
    expect(status.recording).toBe(false);
    expect(status.pauseReasons).toEqual(['noController', 'locked']);
  });

  it('defaults to deny: nothing starts until a route is allowed', async () => {
    const mock = registerSampled();
    await flushResume();
    expect(mock.count('start')).toBe(0);
    expect(gate.getReplayGateStatus().pauseReasons).toEqual(['outOfScope']);

    gate.setReplayRouteAllowed(true, 'tab.market');
    expect(mock.count('start')).toBe(0);
    await flushResume();

    expect(mock.calls).toEqual(['prepare', 'start']);
    expect(gate.getReplayGateStatus()).toMatchObject({
      recording: true,
      sampled: true,
      bucket: 0,
      sessionId: SAMPLED_SID,
      routeKey: 'tab.market',
      pauseReasons: [],
    });
  });

  it('waits a frame through requestAnimationFrame when available', async () => {
    const frames: Array<() => void> = [];
    const globals = globalThis as {
      requestAnimationFrame?: (cb: () => void) => number;
      cancelAnimationFrame?: (id: number) => void;
    };
    globals.requestAnimationFrame = (cb) => {
      frames.push(cb);
      return frames.length;
    };
    globals.cancelAnimationFrame = jest.fn();
    try {
      const mock = registerSampled();
      gate.setReplayRouteAllowed(true, 'tab.market');
      await flush(1000);
      expect(mock.count('start')).toBe(0);

      frames.shift()?.();
      await flushResume();
      expect(mock.count('start')).toBe(1);
    } finally {
      delete globals.requestAnimationFrame;
      delete globals.cancelAnimationFrame;
    }
  });

  it('never starts an unsampled session and clears the analytics link', async () => {
    const mock = registerSampled(createController(UNSAMPLED_SID));
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();

    expect(mock.calls).toEqual([]);
    expect(gate.getReplayGateStatus()).toMatchObject({
      sampled: false,
      bucket: 8559,
      pauseReasons: ['notSampled'],
    });
    expect(mockSetReplayContext).toHaveBeenLastCalledWith(null);
  });

  it('honors forced recording for an unsampled session', async () => {
    const mock = registerSampled(createController(UNSAMPLED_SID), {
      threshold: 0,
      forced: true,
    });
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();

    expect(mock.count('start')).toBe(1);
    expect(gate.getReplayGateStatus()).toMatchObject({
      forced: true,
      sampled: true,
    });
  });

  it('links analytics only while the session is sampled', () => {
    registerSampled();
    expect(mockSetReplayContext).toHaveBeenLastCalledWith({
      sessionId: SAMPLED_SID,
      expiresAt: NOW + gate.REPLAY_ANALYTICS_CONTEXT_TTL_MS,
    });

    gate.unregisterReplayController();
    expect(mockSetReplayContext).toHaveBeenLastCalledWith(null);
  });

  it('stops synchronously on pause and resumes after release', async () => {
    const mock = registerSampled();
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();
    expect(mock.calls).toEqual(['prepare', 'start']);

    const release = gate.acquireReplayPause('password');
    expect(gate.getReplayGateStatus()).toMatchObject({
      recording: false,
      pauseReasons: ['sensitive'],
    });
    await flush();
    expect(mock.calls).toEqual(['prepare', 'start', 'stop']);

    release();
    release();
    await flush(gate.REPLAY_RESUME_DELAY_MS - 50);
    expect(mock.count('start')).toBe(1);
    await flushResume();
    expect(mock.count('start')).toBe(2);
  });

  it('keeps pause tokens ref-counted', async () => {
    const mock = registerSampled();
    gate.setReplayRouteAllowed(true, 'tab.market');
    const releaseA = gate.acquireReplayPause('a');
    const releaseB = gate.acquireReplayPause('b');
    releaseA();
    await flushResume();
    expect(mock.count('start')).toBe(0);
    releaseB();
    await flushResume();
    expect(mock.count('start')).toBe(1);
  });

  it('does not start when release and acquire happen in the same tick', async () => {
    const mock = registerSampled();
    gate.setReplayRouteAllowed(true, 'tab.market');
    const release = gate.acquireReplayPause('first');
    await flushResume();
    expect(mock.count('start')).toBe(0);

    release();
    const releaseSecond = gate.acquireReplayPause('second');
    await flushResume();
    expect(mock.count('start')).toBe(0);
    releaseSecond();
  });

  it('queues the stop behind a start that is still running', async () => {
    const mock = registerSampled();
    const startGate = mock.holdStart();
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();
    expect(mock.calls).toEqual(['prepare', 'start']);

    gate.acquireReplayPause('seed');
    await flush();
    expect(mock.count('stop')).toBe(0);

    startGate.resolve();
    await flush();
    expect(mock.calls).toEqual(['prepare', 'start', 'stop']);
    expect(gate.getReplayGateStatus().recording).toBe(false);
  });

  it('skips the start when the decision changed while preparing', async () => {
    const mock = registerSampled();
    const prepareGate = mock.holdPrepare();
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();
    expect(mock.calls).toEqual(['prepare']);

    gate.setReplayRouteAllowed(false, 'settings');
    prepareGate.resolve();
    await flush();
    expect(mock.count('start')).toBe(0);
    expect(mock.count('stop')).toBe(1);
  });

  it('retries with backoff while the SDK is not active, then gives up', async () => {
    const mock = registerSampled();
    mock.setActiveAfterStart(false);
    gate.setReplayRouteAllowed(true, 'tab.market');
    // Land exactly on the first attempt so retry delays line up.
    await flush(gate.REPLAY_RESUME_DELAY_MS);
    expect(mock.count('start')).toBe(1);

    for (const [index, delay] of gate.REPLAY_START_RETRY_DELAYS_MS.entries()) {
      await flush(delay - 1);
      expect(mock.count('start')).toBe(index + 1);
      await flush(1);
      expect(mock.count('start')).toBe(index + 2);
    }
    await flush(60_000);
    expect(mock.count('start')).toBe(
      gate.REPLAY_START_RETRY_DELAYS_MS.length + 1,
    );
    expect(gate.getReplayGateStatus().recording).toBe(false);
  });

  it('cancels a pending retry when recording must stop', async () => {
    const mock = registerSampled();
    mock.setActiveAfterStart(false);
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();
    expect(mock.count('start')).toBe(1);

    gate.setReplayCondition('locked', true);
    await flush(60_000);
    expect(mock.count('start')).toBe(1);
    expect(mock.count('stop')).toBe(1);
    expect(gate.getReplayGateStatus().pauseReasons).toEqual(['locked']);
  });

  it('sends a stop for every restrictive change once anything started', async () => {
    const mock = registerSampled();
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();

    gate.setReplayCondition('travelMode', true);
    gate.acquireReplayPause('scanner');
    gate.setReplayRouteAllowed(false, 'settings');
    await flush();
    expect(mock.count('stop')).toBe(3);
    expect(mock.count('start')).toBe(1);
  });

  it('starts a new decision when the session rotates', async () => {
    const mock = registerSampled();
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();

    mock.setNextTouchSessionId(SAMPLED_SID_2);
    gate.notifyReplayActivity();
    gate.notifyReplayActivity();
    await flush();
    expect(mock.count('touch')).toBe(1);
    expect(mock.calls).toEqual(['prepare', 'start', 'touch', 'stop']);
    expect(gate.getReplayGateStatus().sessionId).toBe(SAMPLED_SID_2);
    expect(mockSetReplayContext).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionId: SAMPLED_SID_2 }),
    );

    await flushResume();
    expect(mock.count('start')).toBe(2);
    expect(gate.getReplayGateStatus().recording).toBe(true);
  });

  it('stops when the rotated session is not sampled', async () => {
    const mock = registerSampled();
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();

    mock.setNextTouchSessionId(UNSAMPLED_SID);
    gate.notifyReplayActivity();
    await flushResume();
    expect(mock.count('stop')).toBe(1);
    expect(mock.count('start')).toBe(1);
    expect(gate.getReplayGateStatus()).toMatchObject({
      sampled: false,
      recording: false,
    });
    expect(mockSetReplayContext).toHaveBeenLastCalledWith(null);
  });

  it('refreshes the analytics link on activity', async () => {
    registerSampled();
    await flush(10 * 60 * 1000);
    gate.notifyReplayActivity();
    await flush();
    expect(mockSetReplayContext).toHaveBeenLastCalledWith({
      sessionId: SAMPLED_SID,
      expiresAt: Date.now() + gate.REPLAY_ANALYTICS_CONTEXT_TTL_MS,
    });
  });

  it('retries a failed stop once and drops the controller after a second failure', async () => {
    const mock = registerSampled();
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();

    mock.failNextStops(2);
    gate.acquireReplayPause('password');
    await flush();
    expect(mock.count('stop')).toBeGreaterThanOrEqual(2);
    expect(gate.getReplayGateStatus().hasController).toBe(false);
  });

  it('updates threshold and forced when the same controller registers again', async () => {
    const mock = createController(UNSAMPLED_SID);
    registerSampled(mock, { threshold: 0, forced: false });
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();
    expect(mock.count('start')).toBe(0);

    registerSampled(mock, { threshold: 0, forced: true });
    await flushResume();
    expect(mock.count('start')).toBe(1);

    registerSampled(mock, { threshold: 0, forced: false });
    await flush();
    expect(mock.count('stop')).toBe(1);
    expect(gate.getReplayGateStatus().forced).toBe(false);
  });

  it('notifies subscribers on change and keeps the snapshot stable', async () => {
    const statuses: IReplayGateStatus[] = [];
    const unsubscribe = gate.subscribeReplayGateStatus((status) => {
      statuses.push(status);
    });
    const before = gate.getReplayGateStatus();
    expect(gate.getReplayGateStatus()).toBe(before);

    registerSampled();
    gate.setReplayRouteAllowed(true, 'tab.market');
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flushResume();

    expect(statuses.at(-1)).toMatchObject({ recording: true });
    expect(gate.getReplayGateStatus()).toBe(statuses.at(-1));
    const count = statuses.length;
    unsubscribe();
    gate.acquireReplayPause('x');
    expect(statuses).toHaveLength(count);
  });
});
