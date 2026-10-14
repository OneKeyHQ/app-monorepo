import { getOneKeyIdAuthFailureLogLimiterStorage } from './oneKeyIdAuthFailureLogLimiterStorage';

import type { IOneKeyIdAuthFailureLogLimiterStorage } from './oneKeyIdAuthFailureLogLimiterStorage';
import type {
  IOneKeyIdAuthFailureServerParams,
  IOneKeyIdAuthFailureTrigger,
} from '../../../utils/sensitiveErrorMessageUtils';

export type IOneKeyIdAuthFailureLogTrigger =
  | IOneKeyIdAuthFailureTrigger
  | 'unknown';

export type IOneKeyIdAuthFailureLogPayload =
  IOneKeyIdAuthFailureServerParams & {
    trigger: IOneKeyIdAuthFailureLogTrigger;
    reason: string;
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
    // cannot flood either. Repeat summaries are not counted.
    maxEventsPerWindow: 30,
    // Beyond this, the least recently seen signature is summarized and
    // dropped.
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
    typeof entry.payload.reason === 'string' &&
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
    return {
      version: 1,
      windowStartedAt: isFiniteNumber(parsed.windowStartedAt)
        ? parsed.windowStartedAt
        : undefined,
      reportedCount: isFiniteNumber(parsed.reportedCount)
        ? parsed.reportedCount
        : 0,
      signatures,
    };
  } catch {
    return createEmptyState();
  }
}

// Volatile tokens differ between occurrences of one failure (request ids,
// local server ports, durations) and must not split its signature.
function normalizeReasonForSignature(reason: string): string {
  return reason
    .replace(/requestId=\S*/gi, 'requestId=')
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '[uuid]',
    )
    .replace(/\d{4,}/g, '#');
}

// Stable identity of a failure: what triggered it, where it was thrown
// (the reason names the call site) and which Desktop API call failed. It
// never depends on the Error object or on timestamps.
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
    normalizeReasonForSignature(payload.reason),
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

  // Ends expired signature windows, returning summaries for those that had
  // unreported repeats.
  private takeExpiredSummaries(
    state: ILimiterState,
    now: number,
  ): IOneKeyIdAuthFailureRepeatSummary[] {
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
    return summaries;
  }

  private evictLeastRecentlySeen(
    state: ILimiterState,
    keepSignature: string,
  ): IOneKeyIdAuthFailureRepeatSummary[] {
    const summaries: IOneKeyIdAuthFailureRepeatSummary[] = [];
    const signatures = Object.keys(state.signatures)
      .filter((signature) => signature !== keepSignature)
      .toSorted(
        (a, b) =>
          state.signatures[a].lastSeenAt - state.signatures[b].lastSeenAt,
      );
    const overflow =
      Object.keys(state.signatures).length - this.limits.maxTrackedSignatures;
    signatures.slice(0, Math.max(0, overflow)).forEach((signature) => {
      const entry = state.signatures[signature];
      if (entry.repeatCount > 0) {
        summaries.push(toRepeatSummary(entry));
      }
      delete state.signatures[signature];
    });
    return summaries;
  }

  /**
   * Records one occurrence. `shouldReport` says whether to write it to the
   * local log and the server; `summaries` are ended windows to report now.
   */
  consume({
    signature,
    payload,
  }: {
    signature: string;
    payload: IOneKeyIdAuthFailureLogPayload;
  }): {
    shouldReport: boolean;
    summaries: IOneKeyIdAuthFailureRepeatSummary[];
  } {
    const now = this.now();
    const state = this.getState();
    const summaries = this.takeExpiredSummaries(state, now);

    if (
      state.windowStartedAt === undefined ||
      this.isWindowOver(state.windowStartedAt, now)
    ) {
      state.windowStartedAt = now;
      state.reportedCount = 0;
    }

    let entry = state.signatures[signature];
    if (!entry) {
      entry = {
        payload,
        windowStartedAt: now,
        lastSeenAt: now,
        reportedCount: 0,
        repeatCount: 0,
      };
      state.signatures[signature] = entry;
      summaries.push(...this.evictLeastRecentlySeen(state, signature));
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

    this.persist(now, { force: shouldReport || summaries.length > 0 });
    return { shouldReport, summaries };
  }

  // Summaries of windows that have ended since the last call; used by the
  // scene's flush timer when the failure stops recurring.
  takeDueSummaries(): IOneKeyIdAuthFailureRepeatSummary[] {
    const now = this.now();
    const summaries = this.takeExpiredSummaries(this.getState(), now);
    this.persist(now, { force: true });
    return summaries;
  }

  // When the earliest window holding unreported repeats ends.
  getNextSummaryDueAt(): number | undefined {
    let dueAt: number | undefined;
    Object.values(this.getState().signatures).forEach((entry) => {
      if (entry.repeatCount === 0) {
        return;
      }
      const entryDueAt = entry.windowStartedAt + this.limits.windowMs;
      if (dueAt === undefined || entryDueAt < dueAt) {
        dueAt = entryDueAt;
      }
    });
    return dueAt;
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
