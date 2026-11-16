/**
 * useFrameChannelSubscriber — generic main-side receive shell for a bg→main
 * frame channel (design §4A.3). Domain-agnostic glue: it owns ONLY
 *   - SUBSCRIBE-THEN-PULL (subscribe to every kind's event FIRST, then PULL the
 *     authoritative full frames so a push racing the pull is never lost),
 *   - the per-(kind, version) monotonic gate (via the pure `FrameSubscriberGate`),
 *   - the owner filter (ignore frames stamped for a different owner),
 *   - the cross-kind `applyOrder` for the PULL apply, and
 *   - the `cancelled` teardown.
 *
 * Everything domain-specific stays in the CONSUMER's callbacks (`apply`,
 * `onAfterApply`, `onSetup`) — e.g. the cells producer keeps its storeData
 * re-stamp inside `apply`, its registry register/deregister inside `onSetup`'s
 * returned teardown, and its anonymous-store abort by passing `enabled: false`.
 * The 4-hook surface deliberately does NOT try to absorb those (red-team §4A.3).
 */
import { useEffect, useRef } from 'react';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { FrameSubscriberGate } from '@onekeyhq/shared/src/frameChannel';
import type { IFrameSubscriberGateKind } from '@onekeyhq/shared/src/frameChannel';

export interface IFrameChannelKindSubscription<TKind extends string, TPull> {
  kind: TKind;
  /** static (consumer-registered) transport event name for this kind. */
  eventName: string;
  /** gate config (e.g. `{ floorVersion: 0 }` for risky). */
  gate?: IFrameSubscriberGateKind;
  /** owner key carried by a push payload (to drop foreign-owner frames). */
  getOwnerKey: (framePayload: unknown) => string;
  /** monotonic version carried by a push payload. */
  getVersion: (framePayload: unknown) => number;
  /**
   * Optional baseVersion / slotId continuity guard for delta push frames.
   * When it returns false for an incoming push that is newer than `lastVersion`,
   * the subscriber drops the partial delta without advancing `gate` and triggers
   * a full resync `pull({ forceFull: true })`.
   */
  canApplyPush?: (framePayload: unknown, lastVersion: number) => boolean;
  /** domain apply for a push-shaped payload (owner-filtered + version-gated). */
  apply: (framePayload: unknown) => void;
  /** map the PULL result to this kind's push-shaped payload; undefined to skip. */
  fromPull: (pull: TPull) => unknown | undefined;
}

export interface IUseFrameChannelSubscriberParams<TKind extends string, TPull> {
  ownerKey: string;
  /** false to no-op (deps not ready, or an anonymous mount with no identity). */
  enabled: boolean;
  kinds: IFrameChannelKindSubscription<TKind, TPull>[];
  /** kind order applied from the PULL result (e.g. structure before valuation). */
  applyOrder: TKind[];
  pull: (opts?: { forceFull?: boolean }) => Promise<TPull>;
  getPullOwnerKey: (pull: TPull) => string;
  /** domain setup on subscribe; return a teardown (e.g. registry deregister). */
  onSetup?: () => (() => void) | void;
  /** domain post-apply hook per kind (e.g. cold-start persist). */
  onAfterApply?: (kind: TKind) => void;
  /** extra effect deps that should re-run the subscription (e.g. store). */
  extraDeps?: unknown[];
}

const busOn = appEventBus.on.bind(appEventBus) as unknown as (
  t: string,
  cb: (p: unknown) => void,
) => void;
const busOff = appEventBus.off.bind(appEventBus) as unknown as (
  t: string,
  cb: (p: unknown) => void,
) => void;

export function useFrameChannelSubscriber<TKind extends string, TPull>(
  params: IUseFrameChannelSubscriberParams<TKind, TPull>,
): void {
  const { ownerKey, enabled } = params;
  // Latest params via ref so the effect deps stay minimal/stable; the effect
  // re-runs only on enabled/ownerKey/extraDeps changes (matching the producer).
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const extraDeps = params.extraDeps ?? [];

  useEffect(
    () => {
      if (!enabled || !ownerKey) {
        return undefined;
      }
      const p = paramsRef.current;

      const gateConfig = {} as Record<TKind, IFrameSubscriberGateKind>;
      for (const k of p.kinds) {
        gateConfig[k.kind] = k.gate ?? {};
      }
      const gate = new FrameSubscriberGate<TKind>(gateConfig);

      const teardownSetup = p.onSetup?.();

      const gateApply = (
        k: IFrameChannelKindSubscription<TKind, TPull>,
        framePayload: unknown,
      ): void => {
        if (!gate.accept(k.kind, k.getVersion(framePayload))) {
          return;
        }
        k.apply(framePayload);
        p.onAfterApply?.(k.kind);
      };

      let cancelled = false;
      let pullInFlight = false;
      let pendingForceFullPull = false;

      const runPull = (forceFull = false): void => {
        if (cancelled) {
          return;
        }
        if (pullInFlight) {
          if (forceFull) {
            pendingForceFullPull = true;
          }
          return;
        }
        pullInFlight = true;
        void p
          .pull({ forceFull })
          .then((pulled) => {
            if (cancelled || p.getPullOwnerKey(pulled) !== ownerKey) {
              return;
            }
            for (const kind of p.applyOrder) {
              const k = p.kinds.find((x) => x.kind === kind);
              const framePayload = k?.fromPull(pulled);
              if (k && framePayload !== undefined) {
                gateApply(k, framePayload);
              }
            }
          })
          .catch(() => {
            // PULL failure is non-fatal: live pushes keep the list current; the
            // next owner-change / foreground re-sync re-pulls.
          })
          .finally(() => {
            pullInFlight = false;
            if (!cancelled && pendingForceFullPull) {
              pendingForceFullPull = false;
              runPull(true);
            }
          });
      };

      const handlers = p.kinds.map((k) => {
        const handler = (framePayload: unknown): void => {
          if (k.getOwnerKey(framePayload) !== ownerKey) {
            return;
          }
          const version = k.getVersion(framePayload);
          const lastVersion = gate.getLastVersion(k.kind);
          if (version <= lastVersion) {
            return;
          }
          if (k.canApplyPush && !k.canApplyPush(framePayload, lastVersion)) {
            runPull(true);
            return;
          }
          gateApply(k, framePayload);
        };
        busOn(k.eventName, handler);
        return { eventName: k.eventName, handler };
      });

      runPull(false);

      return () => {
        cancelled = true;
        for (const h of handlers) {
          busOff(h.eventName, h.handler);
        }
        teardownSetup?.();
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, ownerKey, ...extraDeps],
  );
}
