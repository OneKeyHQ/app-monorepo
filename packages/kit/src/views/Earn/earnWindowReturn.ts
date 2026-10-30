import { useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import { rootNavigationRef } from '@onekeyhq/components';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EModalStakingRoutes,
  ETabEarnRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

// Back from a page a window opened (the Earn window's Details, the Loans
// window's Manage) opens that window again as it was left (demo 10-30).
// Only a plain back does: the page's back arrow, the header's, the
// browser's. The breadcrumb and the tab bar go where they always go, and so
// does Back once a deposit, a withdrawal or a loan went out from the page

export type IEarnWindowReturn =
  | {
      screen: EModalStakingRoutes.ManagePosition;
      params: IModalStakingParamList[EModalStakingRoutes.ManagePosition];
    }
  | {
      screen: EModalStakingRoutes.EarnLoanRouter;
      params: IModalStakingParamList[EModalStakingRoutes.EarnLoanRouter];
    };

type ITicket = {
  window: IEarnWindowReturn;
  // The page the window closed for: by its name until it shows, then by
  // its key
  pageName: ETabEarnRoutes;
  pageKey?: string;
  leftAt: number;
};

// One at a time: the last page a window opened
let ticket: ITicket | undefined;

// A page showing later than this after its window closed isn't that one
const CLAIM_MS = 5000;
// The screen under the page settles before the window opens over it
const REOPEN_DELAY_MS = 80;

export function leaveEarnWindowFor(
  pageName: ETabEarnRoutes,
  window: IEarnWindowReturn,
) {
  ticket = { window, pageName, leftAt: Date.now() };
}

// What moves funds into or out of a position; a claim leaves it as it was
const MOVING_LABELS = new Set<EEarnLabels>([
  EEarnLabels.Stake,
  EEarnLabels.Withdraw,
  EEarnLabels.Redeem,
  EEarnLabels.Supply,
  EEarnLabels.Borrow,
  EEarnLabels.Repay,
  EEarnLabels.Buy,
  EEarnLabels.Sell,
]);

// As a transaction goes out (the shared confirm's success)
export function endEarnWindowReturnOnSent(label: EEarnLabels | undefined) {
  if (label && MOVING_LABELS.has(label)) {
    ticket = undefined;
  }
}

type IRouteTree = {
  index?: number;
  routes?: { key: string; state?: IRouteTree }[];
};
const getRootTree = () =>
  rootNavigationRef.current?.getRootState() as IRouteTree | undefined;
const hasRoute = (tree: IRouteTree | undefined, key: string): boolean =>
  tree?.routes?.some((item) => item.key === key || hasRoute(item.state, key)) ??
  false;
const getFocusedKey = (tree: IRouteTree | undefined): string | undefined => {
  const routes = tree?.routes ?? [];
  const focused = routes[tree?.index ?? routes.length - 1];
  return focused?.state ? getFocusedKey(focused.state) : focused?.key;
};

function reopen(window: IEarnWindowReturn) {
  setTimeout(() => {
    rootNavigationRef.current?.navigate(ERootRoutes.Modal, {
      screen: EModalRoutes.StakingModal,
      params: window,
    });
  }, REOPEN_DELAY_MS);
}

// On a page a window may have opened: takes the way back once it shows
export function useEarnWindowReturn() {
  const navigation = useNavigation();
  const { key: routeKey, name: routeName } = useRoute();
  useEffect(() => {
    const mine = ticket;
    const isFor = mine?.pageKey
      ? mine.pageKey === routeKey
      : mine?.pageName === routeName && Date.now() - mine.leftAt <= CLAIM_MS;
    if (!mine || !isFor) {
      return undefined;
    }
    mine.pageKey = routeKey;
    const isMine = () => ticket === mine;
    const backToWindow = () => {
      if (isMine()) {
        ticket = undefined;
        reopen(mine.window);
      }
    };
    // What a back from the page shows: the screen under it
    const stackRoutes = navigation.getState()?.routes ?? [];
    const underKey =
      stackRoutes[stackRoutes.findIndex((item) => item.key === routeKey) - 1]
        ?.key;
    let isLeavingByAction = false;
    const offRemove = navigation.addListener('beforeRemove', (event) => {
      isLeavingByAction = true;
      const { type } = event.data.action;
      // The page's back arrow and the header's; the breadcrumb (POP_TO) and
      // the tab bar (POP_TO_TOP) go where they always go
      if (type === 'GO_BACK' || type === 'POP') {
        setTimeout(backToWindow, 0);
      } else if (isMine()) {
        ticket = undefined;
      }
    });
    return () => {
      offRemove();
      if (isLeavingByAction || !underKey) {
        return;
      }
      // Gone without an action: the browser's back, which brings back the
      // history entry before the page, the screen under it in front
      setTimeout(() => {
        const tree = getRootTree();
        if (!hasRoute(tree, routeKey) && getFocusedKey(tree) === underKey) {
          backToWindow();
        }
      }, 0);
    };
  }, [navigation, routeKey, routeName]);
}
