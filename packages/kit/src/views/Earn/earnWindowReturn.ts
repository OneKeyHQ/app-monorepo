import { useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import { rootNavigationRef } from '@onekeyhq/components';
import {
  useAccountSelectorStorageInitDoneAtom,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EModalStakingRoutes,
  ETabEarnRoutes,
  IEarnWindowScope,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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
  scope: IEarnWindowScope;
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
  scope: IEarnWindowScope,
) {
  if (scope.networkId && ('anonymous' in scope || scope.accountId)) {
    ticket = { window, scope, pageName, leftAt: Date.now() };
  }
}

export const matchesEarnWindowScope = (
  a: IEarnWindowScope | undefined,
  b: IEarnWindowScope | undefined,
) => {
  if (!a || !b || a.networkId !== b.networkId) return false;
  if ('anonymous' in a) return 'anonymous' in b;
  return 'accountId' in b && a.accountId === b.accountId;
};

export function useEarnWindowScope({
  accountId,
  indexedAccountId,
  networkId,
}: {
  accountId?: string;
  indexedAccountId?: string;
  networkId?: string;
}): IEarnWindowScope | undefined {
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const [isStorageInitialized] = useAccountSelectorStorageInitDoneAtom();
  if (!networkId || !isStorageInitialized) return undefined;
  if (accountId) {
    const isCurrentWallet =
      selectedAccount.walletId ===
      accountUtils.getWalletIdFromAccountId({ accountId });
    const isCurrentAccount = selectedAccount.othersWalletAccountId
      ? selectedAccount.othersWalletAccountId === accountId
      : isCurrentWallet &&
        selectedAccount.indexedAccountId === indexedAccountId;
    return isCurrentAccount ? { accountId, networkId } : undefined;
  }
  if (
    !selectedAccount.walletId &&
    !selectedAccount.indexedAccountId &&
    !selectedAccount.othersWalletAccountId
  )
    return { anonymous: true, networkId };
  return undefined;
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
export function captureEarnWindowReturnOnSend(
  label: EEarnLabels | undefined,
  scope: IEarnWindowScope,
) {
  const mine = ticket;
  return () => {
    if (
      label &&
      MOVING_LABELS.has(label) &&
      ticket === mine &&
      matchesEarnWindowScope(mine?.scope, scope)
    ) {
      ticket = undefined;
    }
  };
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

function reopen(mine: ITicket, underKey: string | undefined) {
  setTimeout(() => {
    if (ticket !== mine) return;
    ticket = undefined;
    if (underKey && getFocusedKey(getRootTree()) !== underKey) return;
    rootNavigationRef.current?.navigate(ERootRoutes.Modal, {
      screen: EModalRoutes.StakingModal,
      params: mine.window,
    });
  }, REOPEN_DELAY_MS);
}

// On a page a window may have opened: takes the way back once it shows
export function useEarnWindowReturn(scope?: IEarnWindowScope) {
  const navigation = useNavigation();
  const { key: routeKey, name: routeName } = useRoute();
  const accountId = scope && 'accountId' in scope ? scope.accountId : undefined;
  const anonymous = Boolean(scope && 'anonymous' in scope);
  const networkId = scope?.networkId;
  useEffect(() => {
    const mine = ticket;
    if (!mine) return undefined;
    const accountScope =
      networkId && accountId ? { accountId, networkId } : undefined;
    const guestScope: IEarnWindowScope | undefined =
      networkId && anonymous ? { anonymous: true, networkId } : undefined;
    if (!matchesEarnWindowScope(mine.scope, accountScope ?? guestScope)) {
      if (mine.pageKey === routeKey) ticket = undefined;
      return undefined;
    }
    const isFor = mine?.pageKey
      ? mine.pageKey === routeKey
      : mine?.pageName === routeName && Date.now() - mine.leftAt <= CLAIM_MS;
    if (!isFor) {
      return undefined;
    }
    mine.pageKey = routeKey;
    const isMine = () => ticket === mine;
    // What a back from the page shows: the screen under it
    const stackRoutes = navigation.getState()?.routes ?? [];
    const underKey =
      stackRoutes[stackRoutes.findIndex((item) => item.key === routeKey) - 1]
        ?.key;
    let isReopening = false;
    const backToWindow = () => {
      if (isMine() && !isReopening) {
        isReopening = true;
        reopen(mine, underKey);
      }
    };
    let isLeavingByAction = false;
    const offRemove = navigation.addListener('beforeRemove', (event) => {
      isLeavingByAction = true;
      const { type, payload } = event.data.action;
      const isSinglePop =
        type === 'POP' && payload && 'count' in payload && payload.count === 1;
      // The page's back arrow and the header's; the breadcrumb (POP_TO) and
      // the tab bar (POP_TO_TOP) go where they always go
      if (type === 'GO_BACK' || isSinglePop) {
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
  }, [accountId, anonymous, navigation, networkId, routeKey, routeName]);
}
