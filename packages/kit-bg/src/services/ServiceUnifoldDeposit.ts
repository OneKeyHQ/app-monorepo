// cspell: words unifold Unifold hypercore Hypercore
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  assertUnifoldEchoMatches,
  filterUnifoldExecutionsByRecipient,
  formatUnifoldUsdAmount,
  parseUnifoldExecutionCreatedAtMs,
} from '@onekeyhq/shared/src/utils/unifoldDepositUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { UNIFOLD_ERROR_CODE_LOCAL_RECIPIENT_MISMATCH } from '@onekeyhq/shared/types/unifoldDeposit';
import type {
  IUnifoldActivationStatus,
  IUnifoldDepositAddressParams,
  IUnifoldDepositAddressResult,
  IUnifoldDepositDestination,
  IUnifoldDepositExecution,
  IUnifoldExecutionStatus,
  IUnifoldSupportedAsset,
} from '@onekeyhq/shared/types/unifoldDeposit';

import {
  perpsActiveAccountAtom,
  perpsUnifoldDepositTrackingAtom,
} from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

import type {
  IPerpsUnifoldRecipientWatch,
  IPerpsUnifoldTrackedExecution,
} from '../states/jotai/atoms';

const TRACKING_LOOP_INTERVAL_MS = 10 * 1000;
const TRACKING_MAX_AGE_MS = 48 * 60 * 60 * 1000;
// A live session renews its claim on a fixed cadence, so a mute older than a
// few renewal periods means the session is gone without having handed
// tracking back (tab closed, app killed) and the entry must be reactivated.
const TRACKING_MUTE_MAX_AGE_MS = 3 * 60 * 1000;
// How long a recipient watch keeps discovering executions after its session
// last renewed the claim: covers a deposit paid right before the modal closed
// that the vendor only surfaces minutes later, without polling forever.
const TRACKING_WATCH_MAX_AGE_MS = 30 * 60 * 1000;
// An unmuted watch whose window was consumed while the runtime could not poll
// (mobile suspension, app killed) gets this much post-resume discovery time
// instead of being pruned unseen.
const TRACKING_WATCH_RESUME_GRACE_MS = 60 * 1000;
// Iteration gaps beyond this mean the runtime slept or restarted — the normal
// cadence is TRACKING_LOOP_INTERVAL_MS.
const TRACKING_RESUME_GAP_MS = TRACKING_LOOP_INTERVAL_MS * 6;

@backgroundClass()
export default class ServiceUnifoldDeposit extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private trackingLoopTimer: ReturnType<typeof setTimeout> | null = null;

  // All Unifold endpoints opt out of the interceptor's automatic error toast
  // (autoHandleError: false, same pattern as ServiceHistory): the UI renders
  // its own error states, and the 3s poll must never spam global toasts. We
  // re-inspect `code` ourselves and throw a quiet typed error carrying it so
  // the UI can branch on 14101/14102/10422.
  private async requestUnifold<T>({
    method,
    url,
    params,
    body,
  }: {
    method: 'get' | 'post';
    url: string;
    params?: Record<string, unknown>;
    body?: unknown;
  }): Promise<T> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const requestConfig: { autoHandleError?: boolean; params?: unknown } = {
      autoHandleError: false,
      params,
    };
    const resp =
      method === 'get'
        ? await client.get<IApiClientResponse<T>>(url, requestConfig)
        : await client.post<IApiClientResponse<T>>(url, body, requestConfig);
    const { code, message, data } = resp.data;
    if (code !== 0) {
      throw new OneKeyError({
        message: message || 'Unifold request failed',
        code,
        autoToast: false,
      });
    }
    return data;
  }

  @backgroundMethod()
  async getSupportedAssets(
    destination: IUnifoldDepositDestination,
  ): Promise<IUnifoldSupportedAsset[]> {
    // supported-assets is a vendor catalog passthrough: the envelope's `data`
    // wraps the vendor's own `{ data: [...] }` (contract §2.1) — verified
    // against the live local wallet service. Unwrap defensively either way.
    const data = await this.requestUnifold<
      IUnifoldSupportedAsset[] | { data?: IUnifoldSupportedAsset[] }
    >({
      method: 'get',
      url: '/wallet/v1/perp/unifold/supported-assets',
      params: { ...destination },
    });
    if (Array.isArray(data)) {
      return data;
    }
    return data?.data ?? [];
  }

  // Security MUST-2, background half. The kit-side guard cross-checks the
  // recipient against the active-account atom, but every @backgroundMethod is
  // an IPC surface: a UI-side bug or an injected call can hand us any address.
  // bg owns `perpsActiveAccountAtom` (ServiceHyperliquid writes it), so on
  // split-runtime targets this is an independent source rather than a re-read
  // of the value the caller derived from.
  //
  // Positive mismatch only: the atom is not persisted, so a bg restart leaves
  // it null while the UI stays alive. null means "cannot verify", not
  // "different" — rejecting it would brick deposits until the user re-enters
  // Perps, which is a worse failure than the one this guard closes.
  private async assertRecipientIsActivePerpsAccount(recipientAddress: string) {
    const { accountAddress } = await perpsActiveAccountAtom.get();
    if (
      accountAddress &&
      accountAddress.toLowerCase() !== recipientAddress.toLowerCase()
    ) {
      throw new OneKeyError({
        message: 'Unifold recipient is not the active perps account',
        code: UNIFOLD_ERROR_CODE_LOCAL_RECIPIENT_MISMATCH,
        autoToast: false,
      });
    }
  }

  @backgroundMethod()
  async createDepositAddress(
    params: IUnifoldDepositAddressParams,
  ): Promise<IUnifoldDepositAddressResult> {
    await this.assertRecipientIsActivePerpsAccount(params.recipientAddress);
    const result = await this.requestUnifold<IUnifoldDepositAddressResult>({
      method: 'post',
      url: '/wallet/v1/perp/unifold/deposit-address',
      body: params,
    });
    assertUnifoldEchoMatches(result.echo, params);
    return result;
  }

  @backgroundMethod()
  async listDepositExecutions(params: {
    recipientAddress: string;
    since?: string;
  }): Promise<IUnifoldDepositExecution[]> {
    const data = await this.requestUnifold<IUnifoldDepositExecution[]>({
      method: 'get',
      url: '/wallet/v1/perp/unifold/deposit-executions',
      params: { ...params },
    });
    // Enforced here, at the single choke point every consumer goes through:
    // the session poll, the tracker history and the bg announce loop all call
    // this method, so none of them can render — or toast "deposit completed"
    // for — an execution credited to somebody else.
    return filterUnifoldExecutionsByRecipient(
      data ?? [],
      params.recipientAddress,
    );
  }

  // Only meaningful for the HyperCore destination (chainId 1337); the server
  // caches vendor responses for 2 minutes, so no client-side cache is needed.
  @backgroundMethod()
  async getActivationStatus(params: {
    recipientAddress: string;
    sourceAddress?: string;
  }): Promise<IUnifoldActivationStatus> {
    const data = await this.requestUnifold<IUnifoldActivationStatus | null>({
      method: 'get',
      url: '/wallet/v1/perp/unifold/activation-status',
      params: { ...params },
    });
    // `isSanctioned` drives a fail-closed compliance gate, so an unusable
    // payload must never reach the caller as "screened and clear". A code-0
    // response carrying null or partial data is surfaced as a failed lookup
    // and retried like a transport error, rather than resolving into a
    // verdict that can never open the gate and never retries.
    if (typeof data?.isSanctioned !== 'boolean') {
      throw new OneKeyError({
        message: 'Unifold activation status unavailable',
        autoToast: false,
      });
    }
    return data;
  }

  // Called when a deposit-modal session (re)starts polling for a recipient and
  // again on every renewal: the live session becomes the announcer for that
  // recipient, so the bg loop must stay quiet — otherwise both would toast the
  // same terminal transition.
  //
  // Muted, never deleted: the session only sees executions inside its lookback
  // window, so deleting here would strand any older in-flight execution with
  // nobody left to announce its outcome.
  //
  // Also arms the recipient watch. It must be registered while the session is
  // still alive (not at close) because a hard-killed session — extension popup
  // closed, app killed — never runs its unmount handler: the mute then simply
  // expires and the watch lets the loop discover executions the session never
  // handed off.
  @backgroundMethod()
  async claimDepositSessionTracking(params: {
    recipientAddress: string;
    sessionId: string | null;
    sessionStart: number;
  }) {
    const now = Date.now();
    const recipient = params.recipientAddress.toLowerCase();
    await perpsUnifoldDepositTrackingAtom.set((prev) => {
      const watches = prev.watches ?? [];
      const existing = watches.find(
        (w) => w.recipientAddress.toLowerCase() === recipient,
      );
      const updatedWatch: IPerpsUnifoldRecipientWatch = existing
        ? {
            ...existing,
            sessionId: params.sessionId ?? existing.sessionId,
            // min(): a reopened session must not shrink the discovery window
            // of an earlier session for the same recipient.
            sessionStart: Math.min(existing.sessionStart, params.sessionStart),
            watchedAt: now,
            mutedAt: now,
          }
        : {
            recipientAddress: params.recipientAddress,
            sessionId: params.sessionId,
            sessionStart: params.sessionStart,
            knownExecutionIds: [],
            watchedAt: now,
            mutedAt: now,
          };
      return {
        items: prev.items.map((item) =>
          item.recipientAddress.toLowerCase() === recipient
            ? { ...item, mutedAt: now }
            : item,
        ),
        watches: [
          ...watches.filter(
            (w) => w.recipientAddress.toLowerCase() !== recipient,
          ),
          updatedWatch,
        ],
      };
    });
    // The loop must already be running when the session hard-dies, since
    // nothing would kick it afterwards; while the claim is renewed everything
    // stays muted and iterations are cheap no-ops.
    void this.unifoldDepositTrackingLoop();
  }

  // Live sessions register every in-flight execution the moment they see it —
  // muted, so the bg loop stays quiet behind the session — because a
  // hard-killed session never runs its unmount handoff. After the session dies
  // the mute expires and the loop takes over announcing.
  @backgroundMethod()
  async trackLiveSessionExecutions(params: {
    recipientAddress: string;
    sessionId: string | null;
    executions: Array<{
      executionId: string;
      lastStatus: IUnifoldExecutionStatus;
    }>;
  }) {
    if (!params.executions.length) {
      return;
    }
    const now = Date.now();
    await perpsUnifoldDepositTrackingAtom.set((prev) => {
      const existingIds = new Set(prev.items.map((i) => i.executionId));
      const added = params.executions
        .filter((e) => !existingIds.has(e.executionId))
        .map((e) => ({
          executionId: e.executionId,
          recipientAddress: params.recipientAddress,
          sessionId: params.sessionId,
          lastStatus: e.lastStatus,
          trackedAt: now,
          mutedAt: now,
        }));
      return added.length
        ? { ...prev, items: [...prev.items, ...added] }
        : prev;
    });
  }

  // Called by the live session the moment it announces a terminal outcome
  // (success toast; failed/refunded via the status cards): the tracked entry
  // is dropped and the id is recorded on the recipient watch so neither the
  // entry path nor watch discovery can announce it a second time — the
  // unmount unmute would otherwise resurrect it for the bg loop.
  @backgroundMethod()
  async settleAnnouncedExecution(params: {
    recipientAddress: string;
    executionId: string;
  }) {
    const recipient = params.recipientAddress.toLowerCase();
    await perpsUnifoldDepositTrackingAtom.set((prev) => ({
      items: prev.items.filter((i) => i.executionId !== params.executionId),
      watches: (prev.watches ?? []).map((w) =>
        w.recipientAddress.toLowerCase() === recipient &&
        !w.knownExecutionIds.includes(params.executionId)
          ? {
              ...w,
              knownExecutionIds: [...w.knownExecutionIds, params.executionId],
            }
          : w,
      ),
    }));
  }

  // Called by the modal's unmount handler for every session that claimed
  // tracking — even with nothing in flight: it hands still-pending executions
  // to the bg loop, records what the session itself announced, re-arms the
  // recipient watch (a deposit paid just before closing may surface in the
  // API only minutes later) and lifts the session's mute.
  //
  // announcedExecutionIds deliberately excludes terminal executions the
  // priming tick swallowed silently: those were never announced to the user,
  // so the bg loop must stay free to announce them.
  @backgroundMethod()
  async finalizeDepositSessionTracking(params: {
    recipientAddress: string;
    sessionId: string | null;
    sessionStart: number;
    announcedExecutionIds: string[];
    executions: Array<{
      executionId: string;
      lastStatus: IUnifoldExecutionStatus;
    }>;
  }) {
    const now = Date.now();
    const recipient = params.recipientAddress.toLowerCase();
    await perpsUnifoldDepositTrackingAtom.set((prev) => {
      const existingIds = new Set(prev.items.map((i) => i.executionId));
      const added = params.executions
        .filter((e) => !existingIds.has(e.executionId))
        .map((e) => ({
          executionId: e.executionId,
          recipientAddress: params.recipientAddress,
          sessionId: params.sessionId,
          lastStatus: e.lastStatus,
          trackedAt: now,
          mutedAt: null,
        }));
      // The session is over, so it hands announcements back for every entry of
      // this recipient — including ones it never saw itself.
      const unmuted = prev.items.map((item) =>
        item.recipientAddress.toLowerCase() === recipient && item.mutedAt
          ? { ...item, mutedAt: null }
          : item,
      );
      const watches = prev.watches ?? [];
      const existingWatch = watches.find(
        (w) => w.recipientAddress.toLowerCase() === recipient,
      );
      const knownExecutionIds = Array.from(
        new Set([
          ...(existingWatch?.knownExecutionIds ?? []),
          ...params.announcedExecutionIds,
        ]),
      );
      const updatedWatch: IPerpsUnifoldRecipientWatch = {
        recipientAddress: params.recipientAddress,
        sessionId: params.sessionId ?? existingWatch?.sessionId ?? null,
        sessionStart: Math.min(
          existingWatch?.sessionStart ?? params.sessionStart,
          params.sessionStart,
        ),
        knownExecutionIds,
        watchedAt: now,
        mutedAt: null,
      };
      return {
        items: [...unmuted, ...added],
        watches: [
          ...watches.filter(
            (w) => w.recipientAddress.toLowerCase() !== recipient,
          ),
          updatedWatch,
        ],
      };
    });
    void this.unifoldDepositTrackingLoop();
  }

  private trackingLoopBusy = false;

  private trackingLoopRerun = false;

  // null means a fresh runtime: the first iteration after an app restart is
  // treated like a resume-after-gap.
  private trackingLastIterationAt: number | null = null;

  // Self-rescheduling loop: polls the executions endpoint while tracked items
  // or recipient watches remain, toasts on terminal status, ages out stale
  // entries. Safe to kick repeatedly — iterations are serialized (a kick that
  // lands mid-iteration coalesces into exactly one follow-up run), because two
  // concurrent iterations would each toast the same terminal execution before
  // either removed it from the atom.
  @backgroundMethod()
  async unifoldDepositTrackingLoop() {
    if (this.trackingLoopBusy) {
      this.trackingLoopRerun = true;
      return;
    }
    this.trackingLoopBusy = true;
    try {
      await this.runTrackingIteration();
    } catch {
      // The iteration clears its timer up front, so a failure outside the
      // per-recipient try/catch (e.g. a persisted-atom write rejection) would
      // otherwise park the loop with outcomes still tracked. Keep the cadence.
      if (!this.trackingLoopTimer) {
        this.trackingLoopTimer = setTimeout(() => {
          void this.unifoldDepositTrackingLoop();
        }, TRACKING_LOOP_INTERVAL_MS);
      }
    } finally {
      this.trackingLoopBusy = false;
      if (this.trackingLoopRerun) {
        this.trackingLoopRerun = false;
        void this.unifoldDepositTrackingLoop();
      }
    }
  }

  private async runTrackingIteration() {
    if (this.trackingLoopTimer) {
      clearTimeout(this.trackingLoopTimer);
      this.trackingLoopTimer = null;
    }
    // Nothing tracked: return before touching the atom. This iteration runs on
    // every cold start (the bg bootstrap resume), and a user who has never
    // made a Unifold deposit must not pay two persisted writes — plus their
    // bg→UI broadcasts — for an empty snapshot.
    const snapshot = await perpsUnifoldDepositTrackingAtom.get();
    if (!snapshot.items.length && !snapshot.watches?.length) {
      return;
    }
    const now = Date.now();
    const resumedAfterGap =
      this.trackingLastIterationAt === null ||
      now - this.trackingLastIterationAt >= TRACKING_RESUME_GAP_MS;
    this.trackingLastIterationAt = now;
    // A mute is released by the session's unmount handler. If that never ran
    // (tab closed, app killed) the mute would strand the entry forever, so a
    // stale one expires here.
    //
    // Entries/watches unmuted in THIS round are excluded from announcements
    // until the next one: mute expiry runs on the wall clock while claim
    // renewal runs on JS timers that mobile suspends in the background, so
    // right after foreground resume the expiry can be a false positive — the
    // still-alive session gets a full round to renew its claim before the
    // loop starts announcing behind it.
    const justUnmutedExecutionIds = new Set<string>();
    const justUnmutedWatchRecipients = new Set<string>();
    await perpsUnifoldDepositTrackingAtom.set((prev) => {
      let changed = false;
      const items = prev.items.map((item) => {
        if (item.mutedAt && now - item.mutedAt >= TRACKING_MUTE_MAX_AGE_MS) {
          justUnmutedExecutionIds.add(item.executionId);
          changed = true;
          return { ...item, mutedAt: null };
        }
        return item;
      });
      const watches = (prev.watches ?? []).map((w) => {
        if (w.mutedAt && now - w.mutedAt >= TRACKING_MUTE_MAX_AGE_MS) {
          justUnmutedWatchRecipients.add(w.recipientAddress.toLowerCase());
          changed = true;
          // The session stopped renewing — it died or was suspended — so the
          // discovery window restarts from here. watchedAt kept aging on the
          // wall clock during a mobile suspension, and without this reset a
          // watch could be born expired and never get a single discovery poll.
          return { ...w, mutedAt: null, watchedAt: now };
        }
        if (
          resumedAfterGap &&
          !w.mutedAt &&
          now - w.watchedAt >= TRACKING_WATCH_MAX_AGE_MS
        ) {
          changed = true;
          // The window elapsed while the runtime slept or was dead (an
          // unmuted watch is armed at modal close, and mobile suspension /
          // app kill stops the loop while the wall clock keeps running): a
          // deposit the vendor surfaced during that gap is still waiting, so
          // the watch earns a short post-resume discovery window instead of
          // being pruned without a single poll.
          return {
            ...w,
            watchedAt:
              now - TRACKING_WATCH_MAX_AGE_MS + TRACKING_WATCH_RESUME_GRACE_MS,
          };
        }
        return w;
      });
      // Nothing expired is the steady state. A fresh object every tick would
      // persist the atom and broadcast to the UI runtime 6x/minute for as long
      // as anything is tracked — up to the full 48h window — for no state
      // change at all.
      return changed ? { items, watches } : prev;
    });
    const { items, watches = [] } = await perpsUnifoldDepositTrackingAtom.get();
    const liveItems = items.filter(
      (item) =>
        now - item.trackedAt < TRACKING_MAX_AGE_MS &&
        !item.mutedAt &&
        !justUnmutedExecutionIds.has(item.executionId),
    );
    const liveWatches = watches.filter(
      (w) =>
        now - w.watchedAt < TRACKING_WATCH_MAX_AGE_MS &&
        !w.mutedAt &&
        !justUnmutedWatchRecipients.has(w.recipientAddress.toLowerCase()),
    );

    // Terminal outcomes seen this round are only CANDIDATES: toasting happens
    // after the final atom update below re-checks them against fresh state,
    // because a session claim/settle landing while this iteration awaited the
    // network must be able to suppress an announcement decided from the stale
    // snapshot — otherwise the loop and the live session would each toast the
    // same deposit once.
    const terminalCandidates: Array<{
      executionId: string;
      recipientKey: string;
      execution: IUnifoldDepositExecution;
      sessionId: string | null;
      viaEntry: boolean;
    }> = [];
    const discoveredItems: IPerpsUnifoldTrackedExecution[] = [];

    const recipientGroups = new Map<
      string,
      {
        recipientAddress: string;
        tracked: IPerpsUnifoldTrackedExecution[];
        watch?: IPerpsUnifoldRecipientWatch;
      }
    >();
    for (const item of liveItems) {
      const key = item.recipientAddress.toLowerCase();
      const group = recipientGroups.get(key) ?? {
        recipientAddress: item.recipientAddress,
        tracked: [],
      };
      group.tracked.push(item);
      recipientGroups.set(key, group);
    }
    for (const watch of liveWatches) {
      const key = watch.recipientAddress.toLowerCase();
      const group = recipientGroups.get(key) ?? {
        recipientAddress: watch.recipientAddress,
        tracked: [],
      };
      group.watch = watch;
      recipientGroups.set(key, group);
    }

    // Includes muted entries: an id with any entry is already owned by the
    // entry path (or a live session), so discovery must not double-track it.
    const trackedIds = new Set(items.map((i) => i.executionId));

    for (const [recipientKey, group] of recipientGroups) {
      try {
        // A watch-only recipient bounds the query server-side. With tracked
        // entries in the mix the query stays unbounded (an entry's execution
        // may be older than the watch window) and discovery is bounded
        // client-side via createdAt instead.
        const since =
          group.watch && !group.tracked.length
            ? String(group.watch.sessionStart)
            : undefined;
        const executions = await this.listDepositExecutions({
          recipientAddress: group.recipientAddress,
          ...(since ? { since } : undefined),
        });
        const byId = new Map(executions.map((e) => [e.executionId, e]));
        for (const item of group.tracked) {
          const execution = byId.get(item.executionId);
          if (execution?.terminal) {
            terminalCandidates.push({
              executionId: item.executionId,
              recipientKey,
              execution,
              sessionId: item.sessionId,
              viaEntry: true,
            });
          }
        }
        const { watch } = group;
        if (watch) {
          const isDiscoverable = (execution: IUnifoldDepositExecution) => {
            if (
              trackedIds.has(execution.executionId) ||
              watch.knownExecutionIds.includes(execution.executionId)
            ) {
              return false;
            }
            if (!group.tracked.length) {
              return true;
            }
            // Unbounded query: only executions provably inside the watch
            // window are discoverable. A null/unparseable createdAt is
            // skipped — never resurrect an ancient execution as new.
            const createdAtMs = parseUnifoldExecutionCreatedAtMs(
              execution.createdAt,
            );
            return createdAtMs !== null && createdAtMs >= watch.sessionStart;
          };
          // Oldest → newest, mirroring the session's playback order.
          for (const execution of [...executions].toReversed()) {
            if (isDiscoverable(execution)) {
              if (execution.terminal) {
                terminalCandidates.push({
                  executionId: execution.executionId,
                  recipientKey,
                  execution,
                  sessionId: watch.sessionId,
                  viaEntry: false,
                });
              } else {
                discoveredItems.push({
                  executionId: execution.executionId,
                  recipientAddress: group.recipientAddress,
                  sessionId: watch.sessionId,
                  lastStatus: execution.status,
                  trackedAt: now,
                  mutedAt: null,
                });
              }
            }
          }
        }
      } catch {
        // Transient polling failure — keep tracking, retry next tick.
      }
    }

    // Functional update: entries added while this loop awaited network calls
    // (e.g. another modal close, or a session claim removing entries) must not
    // be resurrected or dropped by a stale wholesale overwrite. The announce
    // decision is made HERE, against fresh state, so it commits atomically
    // with the settlement it implies. Approved ids are appended to their
    // recipient watch's knownExecutionIds, so discovery can never re-announce
    // an outcome after its entry is gone.
    let approvedAnnouncements: typeof terminalCandidates = [];
    await perpsUnifoldDepositTrackingAtom.set((prev) => {
      const prevItemsById = new Map(prev.items.map((i) => [i.executionId, i]));
      const prevWatchByRecipient = new Map(
        (prev.watches ?? []).map((w) => [w.recipientAddress.toLowerCase(), w]),
      );
      const approved: typeof terminalCandidates = [];
      const settledIds = new Set<string>();
      const announcedIdsByRecipient = new Map<string, Set<string>>();
      for (const candidate of terminalCandidates) {
        let suppressed: boolean;
        if (candidate.viaEntry) {
          const entry = prevItemsById.get(candidate.executionId);
          // Gone: a session announced and settled it mid-iteration. Muted: a
          // session claimed the recipient mid-iteration and owns the
          // announcement now — keep the entry for it.
          suppressed = !entry || Boolean(entry.mutedAt);
          if (!suppressed) {
            settledIds.add(candidate.executionId);
          }
        } else {
          const watch = prevWatchByRecipient.get(candidate.recipientKey);
          suppressed =
            !watch ||
            Boolean(watch.mutedAt) ||
            watch.knownExecutionIds.includes(candidate.executionId) ||
            prevItemsById.has(candidate.executionId);
        }
        if (!suppressed) {
          approved.push(candidate);
          const set =
            announcedIdsByRecipient.get(candidate.recipientKey) ??
            new Set<string>();
          set.add(candidate.executionId);
          announcedIdsByRecipient.set(candidate.recipientKey, set);
        }
      }
      // A session that claimed the recipient mid-iteration owns announcements
      // now, so entries discovered by this stale round inherit its mute.
      const addedItems = discoveredItems
        .filter((i) => !prevItemsById.has(i.executionId))
        .map((i) => ({
          ...i,
          mutedAt:
            prevWatchByRecipient.get(i.recipientAddress.toLowerCase())
              ?.mutedAt ?? null,
        }));
      const keptItems = prev.items.filter(
        (item) =>
          !settledIds.has(item.executionId) &&
          now - item.trackedAt < TRACKING_MAX_AGE_MS,
      );
      // Muted watches are never pruned on age: while a session keeps the
      // claim renewed, dropping the watch would destroy knownExecutionIds and
      // let already-announced outcomes be rediscovered later.
      const nextWatches = (prev.watches ?? [])
        .filter(
          (w) => w.mutedAt || now - w.watchedAt < TRACKING_WATCH_MAX_AGE_MS,
        )
        .map((w) => {
          const announced = announcedIdsByRecipient.get(
            w.recipientAddress.toLowerCase(),
          );
          if (!announced?.size) {
            return w;
          }
          return {
            ...w,
            knownExecutionIds: Array.from(
              new Set([...w.knownExecutionIds, ...announced]),
            ),
          };
        });
      approvedAnnouncements = approved;
      // Same no-op guard as the mute pass above: with nothing settled, added
      // or aged out — the steady state while a deposit is simply still
      // pending — this tick must not persist and broadcast an identical
      // snapshot.
      const prevWatches = prev.watches ?? [];
      const changed =
        addedItems.length > 0 ||
        keptItems.length !== prev.items.length ||
        nextWatches.length !== prevWatches.length ||
        nextWatches.some((w, index) => w !== prevWatches[index]);
      return changed
        ? { items: [...keptItems, ...addedItems], watches: nextWatches }
        : prev;
    });
    for (const candidate of approvedAnnouncements) {
      this.showTerminalToast(candidate.execution, candidate.sessionId);
    }

    const { items: remainingItems, watches: remainingWatches = [] } =
      await perpsUnifoldDepositTrackingAtom.get();
    if (remainingItems.length || remainingWatches.length) {
      this.trackingLoopTimer = setTimeout(() => {
        void this.unifoldDepositTrackingLoop();
      }, TRACKING_LOOP_INTERVAL_MS);
    }
  }

  private showTerminalToast(
    execution: IUnifoldDepositExecution,
    sessionId: string | null,
  ) {
    if (execution.status === 'succeeded') {
      void this.backgroundApi.serviceApp.showToast({
        method: 'success',
        title: appLocale.intl.formatMessage({
          id: ETranslations.perp_deposit_success_title,
        }),
        message: formatUnifoldUsdAmount(
          execution.destinationAmountUsd ?? execution.sourceAmountUsd,
        ),
      });
      void this.backgroundApi.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
      return;
    }
    // failed / refunded: never invent a failure reason (contract §1). The body
    // stays the bare support reference rather than an English sentence under a
    // localized title; the in-app screens carry the "contact support" wording.
    void this.backgroundApi.serviceApp.showToast({
      method: 'error',
      title: appLocale.intl.formatMessage({
        id: ETranslations.perp_deposit_fail_title,
      }),
      ...(sessionId ? { message: `Ref ${sessionId}` } : undefined),
    });
  }
}
