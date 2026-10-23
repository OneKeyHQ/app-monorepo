import { useSyncExternalStore } from 'react';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import {
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

/** What the home knows about the account, for the card and the modal */
export type IEarnGuideLive = {
  scope: string;
  hasWallet: boolean;
  isWatching: boolean;
  hasPositions: boolean;
  isLoading: boolean;
  hasGas: boolean;
};

export type IEarnGuideRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type IEarnGuideSnapshot = {
  saved: Record<string, IEarnGuideSaved>;
  live?: IEarnGuideLive;
  /** The modal's own check of ETH on Base while step 1 waits */
  polledGas?: { scope: string; amount: number };
  /** The preview key's step; nothing in it is saved or sent */
  previewStep?: IEarnGuideStep;
  /** What was typed in the preview's deposit, for its step 4 */
  previewAmount?: string;
  /** The guide modal is up: the preview key works over it too */
  isModalOpen?: boolean;
  /** The modal's green header, where the growing card's green ends */
  headerHeight?: number;
  /** The modal closed on a finish (Done, Go to position), not
      back to the card */
  closesOnFinish?: boolean;
  /** From the press until the guide is back in the card: the card's place
      stands empty, as the card is the modal */
  isGuideUp?: boolean;
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
// Where the card is now, set by the card while it shows: the guide goes back
// into it there, wherever a resize has moved it since the press
let cardMeasurer: (() => IEarnGuideRect | undefined) | undefined;

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

// One store for the home's card and the guide modal: desktop and web run both
// in one JS runtime, the only places this layout renders
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
  setCardMeasurer(measure: (() => IEarnGuideRect | undefined) | undefined) {
    cardMeasurer = measure;
  },
  measureCard: () => cardMeasurer?.(),
  setModalOpen(isModalOpen: boolean) {
    if (Boolean(snapshot.isModalOpen) !== isModalOpen) {
      update({ isModalOpen });
    }
  },
  setHeaderHeight(headerHeight: number) {
    if (headerHeight !== snapshot.headerHeight) {
      update({ headerHeight });
    }
  },
  setClosesOnFinish(closesOnFinish: boolean) {
    if (Boolean(snapshot.closesOnFinish) !== closesOnFinish) {
      update({ closesOnFinish });
    }
  },
  setGuideUp(isGuideUp: boolean) {
    if (Boolean(snapshot.isGuideUp) !== isGuideUp) {
      update({ isGuideUp });
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
    update({ polledGas: undefined });
  },
  setPreview(previewStep: IEarnGuideStep | undefined, previewAmount?: string) {
    update({
      previewStep,
      previewAmount: previewStep
        ? (previewAmount ?? snapshot.previewAmount)
        : '',
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
  /** What the preview's deposit took, for its step 4 */
  previewAmount?: string;
  isUp: boolean;
  live?: IEarnGuideLive;
};

/** The guide as the card and the modal show it */
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
    previewAmount: snap.previewAmount,
    isUp: Boolean(snap.isGuideUp),
    live,
  };
}
