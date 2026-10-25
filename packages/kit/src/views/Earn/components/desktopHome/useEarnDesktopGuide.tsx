import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { Portal } from '@onekeyhq/components';
import type { IPortalManager } from '@onekeyhq/components/src/hocs/Portal';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { preloadModalNavigator } from '@onekeyhq/kit/src/routes/Modal/lazyModalNavigator';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { preloadEarnGuide } from '../../../Staking/router';

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
import type { IEarnGuideGhostPlan } from './EarnGuideGhost';
import type { IEarnGuideCardPlace, IEarnGuideRect } from './earnGuideStore';

type IEarnGuideGhostRun = {
  direction: IEarnGuideGhostPlan['direction'];
  manager?: IPortalManager;
};

// Some of the card in the window: a card scrolled away gets no move back
const isOnScreen = ({ x, y, width, height }: IEarnGuideRect) =>
  x + width > 0 &&
  y + height > 0 &&
  x < (globalThis.innerWidth ?? 0) &&
  y < (globalThis.innerHeight ?? 0);

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
  // The guide can't be put away: an account back to no positions after
  // finishing it starts over
  const isFinishedWithoutPositions =
    !isLoading && hasWallet && !hasPositions && Boolean(guide.saved.completed);
  useEffect(() => {
    if (isFinishedWithoutPositions) {
      earnGuideStore.reset(guideScope);
    }
  }, [guideScope, isFinishedWithoutPositions]);

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
  // card moves between the two places above everything, see EarnGuideGhost.
  // On wide windows the ghost draws every way in and out (the modal shows
  // and hides at once under it), in place when there is no card to use
  const reducedMotion = useReducedMotion();
  const guideRef = useRef(guide);
  guideRef.current = guide;
  const isWideRef = useRef(isWide);
  isWideRef.current = isWide;
  const ghostRef = useRef<IEarnGuideGhostRun | undefined>(undefined);
  const runGhost = useCallback((plan: IEarnGuideGhostPlan) => {
    ghostRef.current?.manager?.destroy();
    // Filled in below; the run ends well after
    const run: IEarnGuideGhostRun = { direction: plan.direction };
    const handleDone = () => {
      run.manager?.destroy();
      if (ghostRef.current === run) {
        ghostRef.current = undefined;
      }
    };
    run.manager = Portal.Render(
      Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
      <EarnGuideGhost
        {...plan}
        state={guideRef.current.state}
        headerHeight={
          earnGuideStore.getSnapshot().headerHeight ?? EARN_GUIDE_HEADER_HEIGHT
        }
        onDone={handleDone}
      />,
    );
    ghostRef.current = run;
  }, []);
  useEffect(() => () => ghostRef.current?.manager?.destroy(), []);

  // The modal and the guide's page load while the card shows, so the modal is
  // up soon after the card lands, the first time too. A failure is left to
  // the open, which loads them again
  useEffect(() => {
    if (guide.isShown) {
      preloadModalNavigator().catch(() => undefined);
      preloadEarnGuide().catch(() => undefined);
    }
  }, [guide.isShown]);
  const pushGuide = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.EarnGuide,
    });
  }, [navigation]);
  const handleOpenGuide = useCallback(
    (from?: IEarnGuideCardPlace) => {
      // A press while the card is still moving
      if (ghostRef.current) {
        return;
      }
      earnGuideStore.setClosesOnFinish(false);
      // Narrow windows slide the modal up from the bottom instead: no card
      // to grow into
      if (!isWide) {
        pushGuide();
        return;
      }
      runGhost({
        direction: 'open',
        // Reduced motion: the guide fades in where the modal sits
        card: reducedMotion ? undefined : from,
        shownStep: guideRef.current.state.current,
        onArriving: pushGuide,
      });
    },
    [isWide, pushGuide, reducedMotion, runGhost],
  );
  // The modal's way out, drawn here: back into the card where it is now,
  // or in place after a finish (Done, Go to position), with the card
  // scrolled away, or with reduced motion
  useEffect(() => {
    earnGuideStore.setCloseDrawer((leave, shownStep, leaveRendersPage) => {
      if (!isWideRef.current) {
        return false;
      }
      // Pressed again (Escape twice): the way out already runs
      if (ghostRef.current?.direction === 'close') {
        return true;
      }
      const card =
        earnGuideStore.getSnapshot().closesOnFinish ||
        reducedMotion ||
        !guideRef.current.isShown
          ? undefined
          : earnGuideStore.measureCard();
      runGhost({
        direction: 'close',
        card: card && isOnScreen(card) ? card : undefined,
        shownStep,
        onCovered: leave,
        holdsForLeave: leaveRendersPage,
      });
      return true;
    });
    return () => earnGuideStore.setCloseDrawer(undefined);
  }, [reducedMotion, runGhost]);

  return { guide, handleOpenGuide };
}
