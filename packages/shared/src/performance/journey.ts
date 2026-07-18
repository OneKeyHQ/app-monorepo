/* eslint-disable max-classes-per-file */
import { isPerfMonitorEnabled } from './enabled';
import { perfMark } from './mark';

export const PERFORMANCE_JOURNEY_TIMEOUTS = {
  home: 15_000,
  market: 20_000,
  swapQuote: 30_000,
} as const;

export const PERFORMANCE_SUCCESS_SAMPLE_RATE = 0.1;

export type IPerformanceJourneyTerminalState =
  | 'success'
  | 'timeout'
  | 'error'
  | 'cancelled';

export type IPerformanceJourneyTerminalInfo = {
  durationMs: number;
  generation: number;
  journeyId: string;
  sampleRate: number;
  sampled: boolean;
  stageDurations: Readonly<Record<string, number>>;
  state: IPerformanceJourneyTerminalState;
};

type IPerformanceJourneyOptions = {
  generation: number;
  markPrefix: string;
  onTerminal?: (info: IPerformanceJourneyTerminalInfo) => void;
  random?: () => number;
  startedAt?: number;
  successSampleRate?: number;
  timeoutMs: number;
};

type IPerformanceJourneyGlobal = typeof globalThis & {
  __performanceJourneySequence__?: number;
};

function safeInvoke(callback: () => void) {
  try {
    callback();
  } catch {
    // Performance instrumentation must never affect the measured flow.
  }
}

export function getPerformanceNow(): number {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now();
  }
  return Date.now();
}

export function isPerformanceSamplingForced(): boolean {
  try {
    return (
      (typeof process !== 'undefined' &&
        (process.env.NODE_ENV === 'test' ||
          process.env.PERF_MONITOR === '1')) ||
      isPerfMonitorEnabled()
    );
  } catch {
    return false;
  }
}

function createJourneyId(generation: number) {
  const state = globalThis as IPerformanceJourneyGlobal;
  state.__performanceJourneySequence__ =
    (state.__performanceJourneySequence__ ?? 0) + 1;
  return `${generation}-${state.__performanceJourneySequence__}`;
}

function normalizeSampleRate(sampleRate: number) {
  if (!Number.isFinite(sampleRate)) {
    return PERFORMANCE_SUCCESS_SAMPLE_RATE;
  }
  return Math.min(1, Math.max(0, sampleRate));
}

export class PerformanceJourney {
  readonly generation: number;

  readonly journeyId: string;

  private readonly markPrefix: string;

  private readonly onTerminal?: (info: IPerformanceJourneyTerminalInfo) => void;

  private readonly random: () => number;

  private readonly startedAt: number;

  private readonly successSampleRate: number;

  private readonly stageTimes = new Map<string, number>();

  private readonly cleanupCallbacks = new Set<() => void>();

  private terminalState?: IPerformanceJourneyTerminalState;

  private timeoutHandle?: ReturnType<typeof setTimeout>;

  constructor(options: IPerformanceJourneyOptions) {
    this.generation = options.generation;
    this.journeyId = createJourneyId(options.generation);
    this.markPrefix = options.markPrefix;
    this.onTerminal = options.onTerminal;
    this.random = options.random ?? Math.random;
    this.startedAt = options.startedAt ?? getPerformanceNow();
    this.successSampleRate = normalizeSampleRate(
      options.successSampleRate ?? PERFORMANCE_SUCCESS_SAMPLE_RATE,
    );

    const elapsedBeforeStart = Math.max(
      0,
      getPerformanceNow() - this.startedAt,
    );
    const remainingTimeout = Math.max(
      0,
      options.timeoutMs - elapsedBeforeStart,
    );
    this.timeoutHandle = setTimeout(() => {
      this.finish('timeout');
    }, remainingTimeout);
  }

  get isTerminal() {
    return this.terminalState !== undefined;
  }

  get state() {
    return this.terminalState;
  }

  addCleanup(callback: () => void) {
    if (this.isTerminal) {
      safeInvoke(callback);
      return () => undefined;
    }
    this.cleanupCallbacks.add(callback);
    return () => {
      this.cleanupCallbacks.delete(callback);
    };
  }

  mark(stage: string, detail?: unknown) {
    if (this.isTerminal || !stage) {
      return false;
    }
    const now = getPerformanceNow();
    if (!this.stageTimes.has(stage)) {
      this.stageTimes.set(stage, now);
    }
    safeInvoke(() => {
      perfMark(`${this.markPrefix}:${stage}`, detail);
    });
    return true;
  }

  getStageDuration(stage: string): number | undefined {
    const stageTime = this.stageTimes.get(stage);
    return stageTime === undefined
      ? undefined
      : Math.max(0, Math.round(stageTime - this.startedAt));
  }

  getStageDurations(): Readonly<Record<string, number>> {
    return Object.fromEntries(
      [...this.stageTimes.entries()].map(([stage, timestamp]) => [
        stage,
        Math.max(0, Math.round(timestamp - this.startedAt)),
      ]),
    );
  }

  succeed() {
    return this.finish('success');
  }

  error() {
    return this.finish('error');
  }

  cancel() {
    return this.finish('cancelled');
  }

  finish(state: IPerformanceJourneyTerminalState) {
    if (this.isTerminal) {
      return false;
    }

    this.terminalState = state;
    const finishedAt = getPerformanceNow();
    if (this.timeoutHandle !== undefined) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
    for (const cleanup of this.cleanupCallbacks) {
      safeInvoke(cleanup);
    }
    this.cleanupCallbacks.clear();

    if (state !== 'success') {
      safeInvoke(() => {
        perfMark(`${this.markPrefix}:${state}`);
      });
    }

    const forcedSampling = isPerformanceSamplingForced();
    let sampleRate = this.successSampleRate;
    if (forcedSampling || state === 'error' || state === 'timeout') {
      sampleRate = 1;
    }
    const sampled = sampleRate >= 1 || this.random() < sampleRate;
    const terminalInfo: IPerformanceJourneyTerminalInfo = {
      durationMs: Math.max(0, Math.round(finishedAt - this.startedAt)),
      generation: this.generation,
      journeyId: this.journeyId,
      sampleRate,
      sampled,
      stageDurations: this.getStageDurations(),
      state,
    };
    if (this.onTerminal) {
      safeInvoke(() => this.onTerminal?.(terminalInfo));
    }
    return true;
  }
}

export class PerformanceJourneyManager {
  private generation = 0;

  private current?: PerformanceJourney;

  start(options: Omit<IPerformanceJourneyOptions, 'generation'>) {
    this.current?.cancel();
    this.generation += 1;
    const journey = new PerformanceJourney({
      ...options,
      generation: this.generation,
    });
    this.current = journey;
    journey.addCleanup(() => {
      if (this.current === journey) {
        this.current = undefined;
      }
    });
    return journey;
  }

  getCurrent() {
    return this.current;
  }

  isCurrent(journey: PerformanceJourney) {
    return this.current === journey && !journey.isTerminal;
  }

  cancelCurrent() {
    return this.current?.cancel() ?? false;
  }

  dispose() {
    this.cancelCurrent();
  }
}
