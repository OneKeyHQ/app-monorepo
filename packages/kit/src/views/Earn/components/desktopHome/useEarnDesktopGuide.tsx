import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { Portal } from '@onekeyhq/components';
import type { IPortalManager } from '@onekeyhq/components/src/hocs/Portal';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  findGuideGas,
  getEarnGuideNetworkId,
  getGuideScope,
  hasGuideGas,
  nextPreviewStep,
} from './earnGuide.utils';
import { EARN_GUIDE_HEADER_HEIGHT, EarnGuideGhost } from './EarnGuideGhost';
import { earnGuideStore, useEarnGuide } from './earnGuideStore';

import type { IEarnDesktopWalletNetworkGroup } from './earnDesktopHome.utils';
import type { IEarnGuideRect } from './earnGuideStore';

/**
 * The guide for the desktop Earn home: tells the guide what the home knows
 * about the account, opens the modal out of the card and back into it, and
 * listens for the preview key
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
  isWide,
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
  // Wide enough for the centred modal the card grows into
  isWide: boolean;
}) {
  const navigation = useAppNavigation();
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

  // The preview key: Shift+G steps the card and the modal through every
  // state with sample data, then starts the account's guide over. Nothing in
  // it is saved or sent. It works on the page and over the guide modal
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
      // Not while typing, except in an amount field (the guide's deposit
      // form has one focused), where a letter means nothing
      const target = event.target as HTMLElement | null;
      const isAmountField = ['decimal', 'numeric'].includes(
        target?.getAttribute?.('inputmode') ?? '',
      );
      if (
        !isAmountField &&
        (target?.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? ''))
      ) {
        return;
      }
      const snapshot = earnGuideStore.getSnapshot();
      if (!isActiveRef.current && !snapshot.isModalOpen) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const next = nextPreviewStep(snapshot.previewStep);
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

  // The guide grows out of the card and goes back into it: a ghost of the
  // card moves between the two places above everything, see EarnGuideGhost
  const reducedMotion = useReducedMotion();
  const guideRef = useRef(guide);
  guideRef.current = guide;
  const isWideRef = useRef(isWide);
  isWideRef.current = isWide;
  const ghostRef = useRef<IPortalManager | undefined>(undefined);
  const showGhost = useCallback(
    (
      direction: 'open' | 'close',
      card: IEarnGuideRect,
      onLanded?: () => void,
    ) => {
      ghostRef.current?.destroy();
      // Filled in below; the move ends well after
      const ghost: { manager?: IPortalManager } = {};
      const handleDone = () => {
        ghost.manager?.destroy();
        if (ghostRef.current === ghost.manager) {
          ghostRef.current = undefined;
        }
        // An open whose modal never came gives the card back
        if (direction === 'open' && !earnGuideStore.getSnapshot().isModalOpen) {
          earnGuideStore.setGuideUp(false);
        }
      };
      ghost.manager = Portal.Render(
        Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
        <EarnGuideGhost
          direction={direction}
          card={card}
          state={guideRef.current.state}
          headerHeight={
            earnGuideStore.getSnapshot().headerHeight ??
            EARN_GUIDE_HEADER_HEIGHT
          }
          onLanded={onLanded}
          onDone={handleDone}
        />,
      );
      ghostRef.current = ghost.manager;
    },
    [],
  );
  useEffect(() => () => ghostRef.current?.destroy(), []);

  // The guide's page loads while the card shows, so the modal is up soon
  // after the card lands
  useEffect(() => {
    if (guide.isShown) {
      void import('../../pages/EarnGuide');
    }
  }, [guide.isShown]);
  const pushGuide = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.EarnGuide,
    });
  }, [navigation]);
  const handleOpenGuide = useCallback(
    (from?: IEarnGuideRect) => {
      // A press while the card is still moving
      if (ghostRef.current) {
        return;
      }
      earnGuideStore.setFrom(from);
      earnGuideStore.setClosesOnFinish(false);
      earnGuideStore.setGuideUp(true);
      // Narrow windows slide the modal up from the bottom instead: no card
      // to grow into
      if (!from || reducedMotion || !isWide) {
        pushGuide();
        return;
      }
      showGhost('open', from, pushGuide);
    },
    [isWide, pushGuide, reducedMotion, showGhost],
  );
  // Closed back to the page with the card still there: into the card. A
  // finish (Done, Hide guide, Go to position) just closes
  useEffect(() => {
    let wasOpen = Boolean(earnGuideStore.getSnapshot().isModalOpen);
    return earnGuideStore.subscribe(() => {
      const snapshot = earnGuideStore.getSnapshot();
      const isOpen = Boolean(snapshot.isModalOpen);
      const hasClosed = wasOpen && !isOpen;
      // Before acting: what it sets tells this listener again
      wasOpen = isOpen;
      if (!hasClosed) {
        return;
      }
      if (
        !snapshot.closesOnFinish &&
        snapshot.from &&
        !reducedMotion &&
        isWideRef.current &&
        guideRef.current.isShown
      ) {
        showGhost('close', snapshot.from, () =>
          earnGuideStore.setGuideUp(false),
        );
      } else {
        earnGuideStore.setGuideUp(false);
      }
    });
  }, [reducedMotion, showGhost]);

  return { guide, handleOpenGuide };
}
