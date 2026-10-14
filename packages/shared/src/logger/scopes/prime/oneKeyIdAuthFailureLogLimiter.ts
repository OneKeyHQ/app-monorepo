import { getOneKeyIdAuthFailureLogLimiterStorage } from './oneKeyIdAuthFailureLogLimiterStorage';

import type { IOneKeyIdAuthFailureLogLimiterStorage } from './oneKeyIdAuthFailureLogLimiterStorage';
import type {
  IOneKeyIdAuthFailureServerParams,
  IOneKeyIdAuthFailureTrigger,
} from '../../../utils/sensitiveErrorMessageUtils';

export type IOneKeyIdAuthFailureLogTrigger =
  | IOneKeyIdAuthFailureTrigger
  | 'unknown';

// What onekeyIdLoginFailedReason sends. Error details never appear here:
// they stay in the local log line.
export type IOneKeyIdAuthFailureLogPayload =
  IOneKeyIdAuthFailureServerParams & {
    trigger: IOneKeyIdAuthFailureLogTrigger;
    // Code-authored location of the failure (see getOneKeyIdAuthFailureSite).
    failureSite?: string;
  };

// Occurrences of one failure that were not reported, sent once its window
// ends. `requestId` is dropped: it only identified the first occurrence.
export type IOneKeyIdAuthFailureRepeatSummary = Omit<
  IOneKeyIdAuthFailureLogPayload,
  'requestId'
> & {
  repeatCount: number;
  firstRepeatAt: number;
  lastRepeatAt: number;
};

// Occurrences that could not be tracked because every signature slot was in
// use. None of them was written locally or sent; this count is reported once
// when the window ends.
export type IOneKeyIdAuthFailureOverflowSummary = {
  droppedCount: number;
  firstDroppedAt: number;
  lastDroppedAt: number;
};

export type IOneKeyIdAuthFailureDueSummaries = {
  summaries: IOneKeyIdAuthFailureRepeatSummary[];
  overflow?: IOneKeyIdAuthFailureOverflowSummary;
};

export type IOneKeyIdAuthFailureLogLimits = {
  windowMs: number;
  maxEventsPerSignature: Record<IOneKeyIdAuthFailureLogTrigger, number>;
  maxEventsPerWindow: number;
  maxTrackedSignatures: number;
  persistIntervalMs: number;
};

export const ONEKEY_ID_AUTH_FAILURE_LOG_LIMITS: IOneKeyIdAuthFailureLogLimits =
  {
    // Fixed window per failure signature, opened by its first occurrence.
    // The first occurrence after the window ends opens a new one and is
    // reported again; a clock that moved backwards also ends the window.
    windowMs: 60 * 60 * 1000,
    // Occurrences of one signature reported per window. A user retrying the
    // same failing login stays visible a few times; passive checks (provider
    // mounts, session reads, renderer reloads) report once.
    maxEventsPerSignature: { interactive: 5, passive: 1, unknown: 1 },
    // Cap across all signatures in one window, so many distinct failures
    // cannot flood either.
    maxEventsPerWindow: 30,
    // Signatures tracked at once. When every slot is in use, a new signature
    // takes the least recently seen slot without unreported repeats (dropping
    // it emits nothing). Only when every slot holds unreported repeats is it
    // counted in the overflow summary instead. Slots with repeats are kept
    // until their window ends, so one runtime emits at most
    // maxEventsPerWindow reports, about maxTrackedSignatures repeat summaries
    // and one overflow summary per window.
    maxTrackedSignatures: 30,
    // Updates that only count a suppressed repeat are written to storage at
    // most this often (trailing write), so a tight failure loop does not
    // rewrite web storage on every occurrence.
    persistIntervalMs: 1000,
  };

export const ONEKEY_ID_AUTH_FAILURE_LOG_LIMITER_STORAGE_KEY =
  'onekey_id_auth_failure_log_limiter_v1';

type ISignatureEntry = {
  payload: IOneKeyIdAuthFailureLogPayload;
  windowStartedAt: number;
  lastSeenAt: number;
  reportedCount: number;
  repeatCount: number;
  firstRepeatAt?: number;
  lastRepeatAt?: number;
};

type ILimiterState = {
  version: 1;
  windowStartedAt?: number;
  reportedCount: number;
  overflow?: IOneKeyIdAuthFailureOverflowSummary;
  signatures: Record<string, ISignatureEntry>;
};

const createEmptyState = (): ILimiterState => ({
  version: 1,
  reportedCount: 0,
  signatures: {},
});

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function isSignatureEntry(value: unknown): value is ISignatureEntry {
  const entry = value as Partial<ISignatureEntry> | null;
  return (
    !!entry &&
    typeof entry === 'object' &&
    !!entry.payload &&
    typeof entry.payload === 'object' &&
    typeof entry.payload.trigger === 'string' &&
    isFiniteNumber(entry.windowStartedAt) &&
    isFiniteNumber(entry.lastSeenAt) &&
    isFiniteNumber(entry.reportedCount) &&
    isFiniteNumber(entry.repeatCount)
  );
}

function parseState(raw: string | null): ILimiterState {
  if (!raw) {
    return createEmptyState();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ILimiterState> | null;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.signatures ||
      typeof parsed.signatures !== 'object'
    ) {
      return createEmptyState();
    }
    const signatures: Record<string, ISignatureEntry> = {};
    Object.entries(parsed.signatures).forEach(([signature, entry]) => {
      if (isSignatureEntry(entry)) {
        signatures[signature] = entry;
      }
    });
    const { overflow } = parsed;
    return {
      version: 1,
      windowStartedAt: isFiniteNumber(parsed.windowStartedAt)
        ? parsed.windowStartedAt
        : undefined,
      reportedCount: isFiniteNumber(parsed.reportedCount)
        ? parsed.reportedCount
        : 0,
      overflow:
        overflow &&
        isFiniteNumber(overflow.droppedCount) &&
        isFiniteNumber(overflow.firstDroppedAt) &&
        isFiniteNumber(overflow.lastDroppedAt)
          ? overflow
          : undefined,
      signatures,
    };
  } catch {
    return createEmptyState();
  }
}

// Stable identity of a failure: what triggered it, where it failed, how
// (error name/code/status) and which Desktop API call failed. It never
// depends on the Error object, error text, request ids or timestamps.
export function getOneKeyIdAuthFailureSignature(
  payload: IOneKeyIdAuthFailureLogPayload,
): string {
  return [
    payload.trigger,
    payload.source,
    payload.step,
    payload.category,
    payload.errorName,
    payload.errorCode,
    payload.httpStatusCode,
    payload.ipcModule,
    payload.ipcMethod,
    payload.failureSite,
  ]
    .map((value) => (value === undefined ? '' : String(value)))
    .join('|');
}

function toRepeatSummary(
  entry: ISignatureEntry,
): IOneKeyIdAuthFailureRepeatSummary {
  const { requestId: _requestId, ...payload } = entry.payload;
  return {
    ...payload,
    repeatCount: entry.repeatCount,
    firstRepeatAt: entry.firstRepeatAt ?? entry.windowStartedAt,
    lastRepeatAt: entry.lastRepeatAt ?? entry.lastSeenAt,
  };
}

/**
 * Decides which OneKey ID auth failure occurrences are written to local logs
 * and sent to the server, and summarizes the rest. Both the
 * logOneKeyIdLoginFailureReason helper and direct logger calls go through
 * it, because it sits in the logger scene itself.
 */
export class OneKeyIdAuthFailureLogLimiter {
  constructor(
    private readonly options: {
      limits?: IOneKeyIdAuthFailureLogLimits;
      // null disables persistence; undefined uses web storage when present.
      storage?: IOneKeyIdAuthFailureLogLimiterStorage | null;
      now?: () => number;
    } = {},
  ) {}

  private state: ILimiterState | undefined;

  private lastPersistedAt = 0;

  private trailingPersistTimer: ReturnType<typeof setTimeout> | undefined;

  private get limits() {
    return this.options.limits ?? ONEKEY_ID_AUTH_FAILURE_LOG_LIMITS;
  }

  private now() {
    return this.options.now?.() ?? Date.now();
  }

  private getStorage(): IOneKeyIdAuthFailureLogLimiterStorage | undefined {
    if (this.options.storage === null) {
      return undefined;
    }
    return this.options.storage ?? getOneKeyIdAuthFailureLogLimiterStorage();
  }

  private getState(): ILimiterState {
    if (!this.state) {
      let raw: string | null = null;
      try {
        raw =
          this.getStorage()?.getItem(
            ONEKEY_ID_AUTH_FAILURE_LOG_LIMITER_STORAGE_KEY,
          ) ?? null;
      } catch {
        raw = null;
      }
      this.state = parseState(raw);
    }
    return this.state;
  }

  private persist(now: number, { force }: { force: boolean }) {
    if (!force && now - this.lastPersistedAt < this.limits.persistIntervalMs) {
      if (!this.trailingPersistTimer) {
        this.trailingPersistTimer = setTimeout(() => {
          this.trailingPersistTimer = undefined;
          this.writeState(this.now());
        }, this.limits.persistIntervalMs);
        // Node-based runtimes (tests, tooling) must not stay alive for it.
        (this.trailingPersistTimer as { unref?: () => void }).unref?.();
      }
      return;
    }
    this.writeState(now);
  }

  private writeState(now: number) {
    if (this.trailingPersistTimer) {
      clearTimeout(this.trailingPersistTimer);
      this.trailingPersistTimer = undefined;
    }
    this.lastPersistedAt = now;
    try {
      this.getStorage()?.setItem(
        ONEKEY_ID_AUTH_FAILURE_LOG_LIMITER_STORAGE_KEY,
        JSON.stringify(this.getState()),
      );
    } catch {
      // Storage full or unavailable: limits still apply in memory.
    }
  }

  private isWindowOver(windowStartedAt: number, now: number) {
    return (
      now < windowStartedAt || now - windowStartedAt >= this.limits.windowMs
    );
  }

  // Ends expired windows: each signature's (with a summary when it had
  // unreported repeats) and the shared one (with the overflow count).
  private takeDue(
    state: ILimiterState,
    now: number,
  ): IOneKeyIdAuthFailureDueSummaries {
    const summaries: IOneKeyIdAuthFailureRepeatSummary[] = [];
    Object.entries(state.signatures).forEach(([signature, entry]) => {
      if (!this.isWindowOver(entry.windowStartedAt, now)) {
        return;
      }
      if (entry.repeatCount > 0) {
        summaries.push(toRepeatSummary(entry));
      }
      delete state.signatures[signature];
    });
    let overflow: IOneKeyIdAuthFailureOverflowSummary | undefined;
    if (
      state.windowStartedAt !== undefined &&
      this.isWindowOver(state.windowStartedAt, now)
    ) {
      overflow = state.overflow;
      state.windowStartedAt = undefined;
      state.reportedCount = 0;
      state.overflow = undefined;
    }
    return { summaries, overflow };
  }

  // Frees the least recently seen slot that has no unreported repeats, so a
  // burst of distinct failures cannot block new ones until windows expire.
  private freeIdleSlot(state: ILimiterState): boolean {
    let idle: [string, ISignatureEntry] | undefined;
    Object.entries(state.signatures).forEach((item) => {
      if (
        item[1].repeatCount === 0 &&
        (!idle || item[1].lastSeenAt < idle[1].lastSeenAt)
      ) {
        idle = item;
      }
    });
    if (!idle) {
      return false;
    }
    delete state.signatures[idle[0]];
    return true;
  }

  /**
   * Records one occurrence. `shouldReport` says whether to write it to the
   * local log and the server; `summaries` and `overflow` belong to ended
   * windows and are reported now.
   */
  consume({
    signature,
    payload,
  }: {
    signature: string;
    payload: IOneKeyIdAuthFailureLogPayload;
  }): IOneKeyIdAuthFailureDueSummaries & {
    shouldReport: boolean;
  } {
    const now = this.now();
    const state = this.getState();
    const due = this.takeDue(state, now);
    const hasDue = due.summaries.length > 0 || !!due.overflow;

    if (state.windowStartedAt === undefined) {
      state.windowStartedAt = now;
      state.reportedCount = 0;
    }

    let entry = state.signatures[signature];
    if (!entry) {
      if (
        Object.keys(state.signatures).length >=
          this.limits.maxTrackedSignatures &&
        !this.freeIdleSlot(state)
      ) {
        const overflow = state.overflow ?? {
          droppedCount: 0,
          firstDroppedAt: now,
          lastDroppedAt: now,
        };
        overflow.droppedCount += 1;
        overflow.lastDroppedAt = now;
        state.overflow = overflow;
        this.persist(now, { force: hasDue });
        return { shouldReport: false, ...due };
      }
      entry = {
        payload,
        windowStartedAt: now,
        lastSeenAt: now,
        reportedCount: 0,
        repeatCount: 0,
      };
      state.signatures[signature] = entry;
    }
    entry.lastSeenAt = now;

    const shouldReport =
      entry.reportedCount <
        this.limits.maxEventsPerSignature[payload.trigger] &&
      state.reportedCount < this.limits.maxEventsPerWindow;
    if (shouldReport) {
      entry.reportedCount += 1;
      state.reportedCount += 1;
    } else {
      entry.repeatCount += 1;
      entry.firstRepeatAt ??= now;
      entry.lastRepeatAt = now;
    }

    this.persist(now, { force: shouldReport || hasDue });
    return { shouldReport, ...due };
  }

  // Summaries of windows that have ended since the last call; used by the
  // scene's flush timer when failures stop recurring.
  takeDueSummaries(): IOneKeyIdAuthFailureDueSummaries {
    const now = this.now();
    const due = this.takeDue(this.getState(), now);
    this.persist(now, { force: true });
    return due;
  }

  // When the earliest window holding unreported occurrences ends.
  getNextSummaryDueAt(): number | undefined {
    const state = this.getState();
    const dueTimes = Object.values(state.signatures)
      .filter((entry) => entry.repeatCount > 0)
      .map((entry) => entry.windowStartedAt + this.limits.windowMs);
    if (state.overflow && state.windowStartedAt !== undefined) {
      dueTimes.push(state.windowStartedAt + this.limits.windowMs);
    }
    return dueTimes.length > 0 ? Math.min(...dueTimes) : undefined;
  }

  reset() {
    if (this.trailingPersistTimer) {
      clearTimeout(this.trailingPersistTimer);
      this.trailingPersistTimer = undefined;
    }
    this.state = createEmptyState();
    this.lastPersistedAt = 0;
    try {
      this.getStorage()?.removeItem(
        ONEKEY_ID_AUTH_FAILURE_LOG_LIMITER_STORAGE_KEY,
      );
    } catch {
      // Nothing persisted to clear.
    }
  }
}

// One limiter per JS runtime. On iOS/Android/extension, main and bg each
// hold their own and limit their own reports.
export const oneKeyIdAuthFailureLogLimiter =
  new OneKeyIdAuthFailureLogLimiter();
