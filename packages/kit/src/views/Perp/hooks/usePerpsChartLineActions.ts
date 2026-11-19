import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

import { Toast } from '@onekeyhq/components';
import type { ITradingViewNativeReferenceLineAction } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import type { ITVLine } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/types';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { getPerpsOrderChangedMessage } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/config';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { formatHlPrice } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  getPerpsAccountKey,
  isPerpsAccountSelectionResolved,
} from '../utils/accountScopedData';

import { useEnsureTradingEnabled } from './useEnableTradingWithDepositFallback';

const ORDER_SYNC_TIMEOUT_MS = 10_000;

type IChartLineActionScope = {
  accountKey: ReturnType<typeof getPerpsAccountKey>;
  symbol: string;
};

type IPendingChartLineAction = {
  type: ITradingViewNativeReferenceLineAction['type'];
  originalPrice: number;
  price?: number;
  scope: IChartLineActionScope;
};

function isSameScope(a: IChartLineActionScope, b: IChartLineActionScope) {
  return a.accountKey === b.accountKey && a.symbol === b.symbol;
}

// Shared by every chart on screen, keyed by line ID, which names the account
// and the order. Split-view panels can show one token and trading moves
// between them with the selection, so an order that one chart is changing has
// to stay locked in the others.
let pendingChartLineActions: Readonly<Record<string, IPendingChartLineAction>> =
  {};
const pendingChartLineActionListeners = new Set<() => void>();

function subscribePendingChartLineActions(listener: () => void) {
  pendingChartLineActionListeners.add(listener);
  return () => {
    pendingChartLineActionListeners.delete(listener);
  };
}

function getPendingChartLineActions() {
  return pendingChartLineActions;
}

/**
 * Sets, replaces or removes the action of one line, and only while `expected`
 * is the one in place: a start never takes over a line that is busy, and a
 * late removal never drops a newer action.
 */
function setPendingChartLineAction(
  id: string,
  expected: IPendingChartLineAction | undefined,
  next: IPendingChartLineAction | undefined,
) {
  if (pendingChartLineActions[id] !== expected) return false;
  const actions = { ...pendingChartLineActions };
  if (next) {
    actions[id] = next;
  } else {
    delete actions[id];
  }
  pendingChartLineActions = actions;
  pendingChartLineActionListeners.forEach((listener) => listener());
  return true;
}

export function usePerpsChartLineActions({
  lines,
  enabled,
  symbol,
  szDecimals,
  isSpot,
}: {
  lines: ITVLine[];
  enabled: boolean;
  symbol: string;
  szDecimals: number;
  isSpot: boolean;
}) {
  const actions = useHyperliquidActions();
  const ensureTradingEnabled = useEnsureTradingEnabled();
  const [account] = usePerpsActiveAccountAtom();
  const [loading] = usePerpsAccountLoadingInfoAtom();
  const { activeAccount: selectedAccount } = useActiveAccount({ num: 0 });
  const accountKey = getPerpsAccountKey(account);
  const scope = useMemo(() => ({ accountKey, symbol }), [accountKey, symbol]);
  const canInteract =
    enabled &&
    Boolean(account.accountAddress) &&
    isPerpsAccountSelectionResolved({
      selectedWalletReady: selectedAccount.ready,
      selectAccountLoading: loading.selectAccountLoading,
      selectedAccountId: selectedAccount.account?.id,
      selectedIndexedAccountId: selectedAccount.indexedAccount?.id,
      activeAccountId: account.accountId,
      activeIndexedAccountId: account.indexedAccountId,
    });
  const getLineId = useCallback(
    (line: ITVLine) => `perps:${accountKey ?? ''}:${line.id}`,
    [accountKey],
  );
  const latest = useRef({ scope, lines, canInteract, getLineId });
  latest.current = { scope, lines, canInteract, getLineId };
  const mounted = useRef(true);
  const pendingActions = useSyncExternalStore(
    subscribePendingChartLineActions,
    getPendingChartLineActions,
    getPendingChartLineActions,
  );
  const linePrices = useMemo(
    () => new Map(lines.map((line) => [getLineId(line), Number(line.price)])),
    [getLineId, lines],
  );
  // What this chart shows as pending: the actions on its own lines that the
  // order stream has not caught up with.
  const pending = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(pendingActions).filter(
          ([id, action]) =>
            isSameScope(action.scope, scope) &&
            linePrices.has(id) &&
            (action.price === undefined ||
              linePrices.get(id) === action.originalPrice),
        ),
      ),
    [linePrices, pendingActions, scope],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    for (const [id, action] of Object.entries(pendingActions)) {
      if (
        isSameScope(action.scope, scope) &&
        pending[id] !== action &&
        // The order stream caught up. A chart that is not trading may not
        // have every line of its token yet, so a line it lacks tells nothing.
        (canInteract || linePrices.has(id))
      ) {
        setPendingChartLineAction(id, action, undefined);
      }
    }
  }, [canInteract, linePrices, pending, pendingActions, scope]);

  const onReferenceLineAction = useCallback(
    async (action: ITradingViewNativeReferenceLineAction) => {
      const assertCurrent = () => {
        const current = latest.current;
        const line = current.lines.find(
          (item) => current.getLineId(item) === action.id,
        );
        if (
          !mounted.current ||
          current.scope !== scope ||
          !current.canInteract ||
          !line?.meta?.orderId ||
          Number(line.price) !== action.originalPrice ||
          (action.type === 'priceChange' && !line.editable)
        ) {
          const message = getPerpsOrderChangedMessage();
          Toast.error({ title: message });
          throw new OneKeyLocalError(message);
        }
        return line;
      };
      const line = assertCurrent();
      const expectedAccountAddress = account.accountAddress;
      const oid = Number(line.meta?.orderId);
      if (
        !expectedAccountAddress ||
        !Number.isSafeInteger(oid) ||
        oid < 0 ||
        pendingChartLineActions[action.id]
      )
        return;
      const newPrice =
        action.type === 'priceChange'
          ? formatHlPrice(action.price, szDecimals, isSpot ? 'spot' : 'perp')
          : undefined;
      if (
        action.type === 'priceChange' &&
        (!newPrice ||
          !Number.isFinite(Number(newPrice)) ||
          Number(newPrice) <= 0 ||
          Number(newPrice) === Number(line.price))
      )
        return;

      const pendingAction: IPendingChartLineAction = {
        type: action.type,
        originalPrice: action.originalPrice,
        price: newPrice ? Number(newPrice) : undefined,
        scope,
      };
      if (!setPendingChartLineAction(action.id, undefined, pendingAction)) {
        return;
      }
      try {
        await ensureTradingEnabled();
        assertCurrent();
        if (action.type === 'cancel') {
          await actions.current.cancelChartOrder({
            oid,
            coin: line.meta?.coin ?? symbol,
            expectedAccountAddress,
          });
        } else if (newPrice) {
          await actions.current.amendChartOrder({
            oid,
            coin: line.meta?.coin ?? symbol,
            newPrice,
            expectedAccountAddress,
          });
          // Keep a new token until the order stream catches up; finally only
          // clears the submission token, never this preview or a newer action.
          const awaitingSync = { ...pendingAction };
          if (
            setPendingChartLineAction(action.id, pendingAction, awaitingSync)
          ) {
            setTimeout(
              () =>
                setPendingChartLineAction(action.id, awaitingSync, undefined),
              ORDER_SYNC_TIMEOUT_MS,
            );
          }
        }
      } finally {
        setPendingChartLineAction(action.id, pendingAction, undefined);
      }
    },
    [
      scope,
      account.accountAddress,
      actions,
      ensureTradingEnabled,
      isSpot,
      symbol,
      szDecimals,
    ],
  );

  return { canInteract, getLineId, onReferenceLineAction, pending };
}
