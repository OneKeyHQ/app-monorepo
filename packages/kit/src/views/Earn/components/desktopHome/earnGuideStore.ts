import { useSyncExternalStore } from 'react';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import {
  countsAsGuideDeposit,
  deriveGuideState,
  getPreviewGuideState,
  hasGuideGas,
  shouldShowGuide,
} from './earnGuide.utils';

import type {
  IEarnGuideSaved,
  IEarnGuideState,
  IEarnGuideStep,
} from './earnGuide.utils';

/** What the home knows about the account, for the checklist */
export type IEarnGuideLive = {
  scope: string;
  hasWallet: boolean;
  isWatching: boolean;
  hasPositions: boolean;
  isLoading: boolean;
  hasGas: boolean;
};

type IEarnGuideSnapshot = {
  saved: Record<string, IEarnGuideSaved>;
  live?: IEarnGuideLive;
  /** The checklist's own check of ETH on Base while task 1 waits */
  polledGas?: { scope: string; amount: number };
  /** The preview key's task; nothing in it is saved or sent */
  previewStep?: IEarnGuideStep;
  /** The checklist folded or opened during the preview */
  previewCollapsed?: boolean;
};

const EMPTY_SAVED: IEarnGuideSaved = {};

function readSaved(): Record<string, IEarnGuideSaved> {
  try {
    return (
      appStorage.syncStorage.getObject<Record<string, IEarnGuideSaved>>(
        EAppSyncStorageKeys.onekey_earn_desktop_guide_v1,
      ) ?? {}
    );
  } catch {
    return {};
  }
}

let snapshot: IEarnGuideSnapshot = { saved: readSaved() };
const listeners = new Set<() => void>();

function update(next: Partial<IEarnGuideSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

function writeSaved(saved: Record<string, IEarnGuideSaved>) {
  update({ saved });
  void appStorage.syncStorage.setObject(
    EAppSyncStorageKeys.onekey_earn_desktop_guide_v1,
    saved,
  );
}

// One store for the home, the checklist and the Earn window: desktop and web
// run them in one JS runtime, the only places this layout renders
export const earnGuideStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,
  setLive(live: IEarnGuideLive) {
    const current = snapshot.live;
    if (
      current &&
      (Object.keys(live) as (keyof IEarnGuideLive)[]).every(
        (key) => current[key] === live[key],
      )
    ) {
      return;
    }
    update({ live });
  },
  setPolledGas(polledGas: IEarnGuideSnapshot['polledGas']) {
    update({ polledGas });
  },
  save(scope: string, patch: IEarnGuideSaved) {
    writeSaved({
      ...snapshot.saved,
      [scope]: { ...snapshot.saved[scope], ...patch },
    });
  },
  /** Starts the account's guide over */
  reset(scope: string) {
    const { [scope]: _, ...rest } = snapshot.saved;
    writeSaved(rest);
    update({ polledGas: undefined });
  },
  /**
   * A deposit went out of the Earn window: the guide's second task, when
   * the account on the home had no position before it
   */
  markDeposited() {
    const { live } = snapshot;
    if (!live) {
      return;
    }
    const saved = snapshot.saved[live.scope] ?? EMPTY_SAVED;
    if (countsAsGuideDeposit({ ...live, saved })) {
      earnGuideStore.save(live.scope, { depositedAt: Date.now() });
    }
  },
  /** My portfolio opened after that deposit: the guide's last task */
  markPositionViewed() {
    const { live } = snapshot;
    const saved = live ? snapshot.saved[live.scope] : undefined;
    if (live && saved?.depositedAt && !saved.completed) {
      earnGuideStore.save(live.scope, { completed: true });
    }
  },
  setCollapsed(scope: string, collapsed: boolean) {
    if (snapshot.previewStep) {
      update({ previewCollapsed: collapsed });
      return;
    }
    earnGuideStore.save(scope, { collapsed });
  },
  setPreview(previewStep: IEarnGuideStep | undefined) {
    update({ previewStep, previewCollapsed: undefined });
  },
};

export function useEarnGuideSnapshot() {
  return useSyncExternalStore(
    earnGuideStore.subscribe,
    earnGuideStore.getSnapshot,
    earnGuideStore.getSnapshot,
  );
}

export type IEarnGuide = {
  scope: string;
  saved: IEarnGuideSaved;
  state: IEarnGuideState;
  isShown: boolean;
  isPreview: boolean;
  /** Folded to its pill by the user; undefined until they fold or open it */
  isCollapsed?: boolean;
  live?: IEarnGuideLive;
};

/** The guide as the checklist shows it */
export function useEarnGuide(): IEarnGuide {
  const snap = useEarnGuideSnapshot();
  const { live, previewStep } = snap;
  const scope = live?.scope ?? 'none';
  const saved = snap.saved[scope] ?? EMPTY_SAVED;
  const hasGas =
    Boolean(live?.hasGas) ||
    (snap.polledGas?.scope === scope && hasGuideGas(snap.polledGas.amount));
  return {
    scope,
    saved,
    state: previewStep
      ? getPreviewGuideState(previewStep)
      : deriveGuideState({ hasGas, saved }),
    isShown: live
      ? shouldShowGuide({ ...live, saved, previewStep })
      : Boolean(previewStep),
    isPreview: Boolean(previewStep),
    isCollapsed: previewStep ? snap.previewCollapsed : saved.collapsed,
    live,
  };
}
