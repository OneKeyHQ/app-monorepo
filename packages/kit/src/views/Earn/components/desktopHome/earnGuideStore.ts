import { useSyncExternalStore } from 'react';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import {
  EARN_GUIDE_YIELD_SCROLL,
  countsAsGuideDeposit,
  deriveGuideState,
  getPreviewGuideState,
  hasGuideGas,
  shouldShowGuide,
} from './earnGuide.utils';

import type {
  IEarnGuidePreview,
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
  /** The checklist's own check of USDC on Base while step 3 waits for it */
  polledDeposit?: { scope: string; amount: number };
  /** The preview key's task; nothing in it is saved or sent */
  previewStep?: IEarnGuideStep;
  /** The preview shows step 3 as a wallet with nothing to deposit has it */
  previewNeedsFunds?: boolean;
  /** The checklist folded or opened during the preview */
  previewCollapsed?: boolean;
  /** Accounts whose guide was skipped; forgotten when the app closes */
  skipped?: Record<string, boolean>;
  /**
   * Accounts whose open window folded as the page was scrolled, and the ones
   * whose window the user then opened: that one stays. Both forgotten when
   * the app closes
   */
  yielded?: Record<string, boolean>;
  pinned?: Record<string, boolean>;
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
  setPolledDeposit(
    polledDeposit: NonNullable<IEarnGuideSnapshot['polledDeposit']>,
  ) {
    const current = snapshot.polledDeposit;
    if (
      current?.scope !== polledDeposit.scope ||
      current.amount !== polledDeposit.amount
    ) {
      update({ polledDeposit });
    }
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
    update({ polledGas: undefined, polledDeposit: undefined });
  },
  /**
   * A deposit went out of the Earn window: the guide's third step, when
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
  /**
   * A vault picked in the Earn window: the guide's second step, and where
   * its Deposit step opens
   */
  markVaultChosen(vaultKey: string) {
    const { live } = snapshot;
    if (!live) {
      return;
    }
    const saved = snapshot.saved[live.scope] ?? EMPTY_SAVED;
    if (
      countsAsGuideDeposit({ ...live, saved }) &&
      saved.vaultKey !== vaultKey
    ) {
      earnGuideStore.save(live.scope, { vaultKey });
    }
  },
  /** My portfolio opened after that deposit: the guide's last step */
  markPositionViewed() {
    const { live } = snapshot;
    const saved = live ? snapshot.saved[live.scope] : undefined;
    if (live && saved?.depositedAt && !saved.completed) {
      earnGuideStore.save(live.scope, { completed: true });
    }
  },
  setCollapsed(scope: string, collapsed: boolean) {
    // Opened by the user, the window stays open as the page scrolls
    const pinned = collapsed
      ? snapshot.pinned
      : { ...snapshot.pinned, [scope]: true };
    if (snapshot.previewStep) {
      update({ previewCollapsed: collapsed, pinned });
      return;
    }
    update({ pinned });
    earnGuideStore.save(scope, { collapsed });
  },
  /**
   * The home scrolled: far enough, the open window folds out of the way of
   * the list it covers, until the user opens it again
   */
  noteScroll(offsetY: number) {
    const scope = snapshot.live?.scope ?? 'none';
    if (
      offsetY >= EARN_GUIDE_YIELD_SCROLL &&
      !snapshot.yielded?.[scope] &&
      !snapshot.pinned?.[scope]
    ) {
      update({ yielded: { ...snapshot.yielded, [scope]: true } });
    }
  },
  /**
   * Skipped for now: gone until the app is opened again, when it is back
   * folded to its pill. Returns the way to take the skip back. In the
   * preview it ends the preview, with nothing to take back
   */
  skip(scope: string): (() => void) | undefined {
    if (snapshot.previewStep) {
      earnGuideStore.setPreview(undefined);
      return undefined;
    }
    const collapsed = snapshot.saved[scope]?.collapsed;
    update({ skipped: { ...snapshot.skipped, [scope]: true } });
    earnGuideStore.save(scope, { collapsed: true });
    return () => {
      update({ skipped: { ...snapshot.skipped, [scope]: false } });
      earnGuideStore.save(scope, { collapsed });
    };
  },
  setPreview(preview: IEarnGuidePreview | undefined) {
    // Each state of the preview shows in the open window again
    const scope = snapshot.live?.scope ?? 'none';
    update({
      previewStep: preview?.step,
      previewNeedsFunds: preview?.needsFunds,
      previewCollapsed: undefined,
      yielded: { ...snapshot.yielded, [scope]: false },
    });
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
  /** Folded by itself as the page was scrolled */
  isYielding: boolean;
  /** USDC on Base as the checklist's own check found it */
  polledDeposit?: number;
  /** The preview shows step 3 as a wallet with nothing to deposit has it */
  previewNeedsFunds: boolean;
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
      ? shouldShowGuide({
          ...live,
          saved,
          previewStep,
          isSkipped: Boolean(snap.skipped?.[scope]),
        })
      : Boolean(previewStep),
    isPreview: Boolean(previewStep),
    isCollapsed: previewStep ? snap.previewCollapsed : saved.collapsed,
    isYielding: Boolean(snap.yielded?.[scope]) && !snap.pinned?.[scope],
    polledDeposit:
      snap.polledDeposit?.scope === scope
        ? snap.polledDeposit.amount
        : undefined,
    previewNeedsFunds: Boolean(previewStep && snap.previewNeedsFunds),
    live,
  };
}
