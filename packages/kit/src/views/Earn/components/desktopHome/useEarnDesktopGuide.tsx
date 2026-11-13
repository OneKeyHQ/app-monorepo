import { useEffect, useMemo, useRef } from 'react';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  findGuideGas,
  getEarnGuideNetworkId,
  getGuideScope,
  hasGuideGas,
  isGuideOverWithoutPositions,
  nextGuidePreview,
} from './earnGuide.utils';
import { earnGuideStore, useEarnGuide } from './earnGuideStore';

import type { IEarnDesktopWalletNetworkGroup } from './earnDesktopHome.utils';

/**
 * The guide for the desktop Earn home: tells the checklist what the home
 * knows about the account, and listens for the preview key
 */
export function useEarnDesktopGuide({
  accountId,
  indexedAccountId,
  walletId,
  hasWallet,
  hasPositions,
  isLoading,
  walletNetworkGroups,
  isActive,
}: {
  accountId?: string;
  indexedAccountId?: string;
  walletId?: string;
  hasWallet: boolean;
  hasPositions: boolean;
  isLoading: boolean;
  walletNetworkGroups: IEarnDesktopWalletNetworkGroup[];
  // The DeFi tab is the one on screen
  isActive: boolean;
}) {
  const guideScope = getGuideScope({ accountId, indexedAccountId });
  const gas = useMemo(
    () => findGuideGas(walletNetworkGroups, getEarnGuideNetworkId()),
    [walletNetworkGroups],
  );
  useEffect(() => {
    earnGuideStore.setLive({
      scope: guideScope,
      hasWallet,
      isWatching: walletId
        ? accountUtils.isWatchingWallet({ walletId })
        : false,
      hasPositions,
      isLoading,
      hasGas: hasGuideGas(gas),
    });
  }, [gas, guideScope, hasPositions, hasWallet, isLoading, walletId]);
  const guide = useEarnGuide();
  // The guide can't be put away: an account back to no positions after
  // finishing it starts over
  const { saved } = guide;
  useEffect(() => {
    if (
      !isLoading &&
      hasWallet &&
      isGuideOverWithoutPositions({ saved, hasPositions, now: Date.now() })
    ) {
      earnGuideStore.reset(guideScope);
    }
  }, [guideScope, hasPositions, hasWallet, isLoading, saved]);

  // The preview key: Shift+G steps the checklist through every state with
  // sample data, then starts the account's guide over. Nothing in it is
  // saved or sent
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  useEffect(() => {
    const handleKeyUp = (event: KeyboardEvent) => {
      if (
        event.code !== 'KeyG' ||
        !event.shiftKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      // Not while typing
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      ) {
        return;
      }
      if (!isActiveRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const snapshot = earnGuideStore.getSnapshot();
      const next = nextGuidePreview(
        snapshot.previewStep
          ? {
              step: snapshot.previewStep,
              needsFunds: snapshot.previewNeedsFunds,
            }
          : undefined,
      );
      if (!next) {
        earnGuideStore.reset(snapshot.live?.scope ?? guideScope);
      }
      earnGuideStore.setPreview(next);
    };
    // On the key's release: while a field has focus the app keeps the
    // presses to itself, and only the release comes through
    globalThis.addEventListener?.('keyup', handleKeyUp, true);
    return () => globalThis.removeEventListener?.('keyup', handleKeyUp, true);
  }, [guideScope]);

  return { guide };
}
