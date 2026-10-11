import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

type IPendingChartLineAction = {
  originalPrice: number;
  price?: number;
  scope: { accountKey: ReturnType<typeof getPerpsAccountKey>; symbol: string };
  syncDeadline?: number;
};

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
  const inFlight = useRef(new Map<string, IPendingChartLineAction>());
  const [pendingActions, setPendingActions] = useState<
    Record<string, IPendingChartLineAction>
  >({});
  const pending = useMemo(() => {
    const prices = new Map(
      lines.map((line) => [getLineId(line), Number(line.price)]),
    );
    return Object.fromEntries(
      Object.entries(pendingActions).filter(
        ([id, action]) =>
          action.scope === scope &&
          prices.has(id) &&
          (action.price === undefined ||
            prices.get(id) === action.originalPrice),
      ),
    );
  }, [getLineId, lines, pendingActions, scope]);
  const removePending = useCallback(
    (id: string, action: IPendingChartLineAction) => {
      if (inFlight.current.get(id) !== action) return;
      inFlight.current.delete(id);
      if (!mounted.current) return;
      setPendingActions((current) => {
        if (current[id] !== action) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
    },
    [],
  );
  useEffect(() => {
    const pendingRequests = inFlight.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingRequests.clear();
    };
  }, []);
  useEffect(() => {
    for (const [id, action] of Object.entries(pendingActions)) {
      if (pending[id] !== action) removePending(id, action);
    }
    const timers = Object.entries(pending).flatMap(([id, action]) =>
      action.syncDeadline === undefined
        ? []
        : [
            setTimeout(
              () => removePending(id, action),
              Math.max(action.syncDeadline - Date.now(), 0),
            ),
          ],
    );
    return () => timers.forEach(clearTimeout);
  }, [pending, pendingActions, removePending]);

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
        inFlight.current.has(action.id)
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
        originalPrice: action.originalPrice,
        price: newPrice ? Number(newPrice) : undefined,
        scope,
      };
      inFlight.current.set(action.id, pendingAction);
      setPendingActions((current) => ({
        ...current,
        [action.id]: pendingAction,
      }));
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
          if (
            mounted.current &&
            latest.current.scope === scope &&
            inFlight.current.get(action.id) === pendingAction
          ) {
            // Keep a new token until the order stream catches up; finally only
            // clears the submission token, never this preview or a newer action.
            const awaitingSync = {
              ...pendingAction,
              syncDeadline: Date.now() + ORDER_SYNC_TIMEOUT_MS,
            };
            inFlight.current.set(action.id, awaitingSync);
            setPendingActions((current) =>
              current[action.id] === pendingAction
                ? { ...current, [action.id]: awaitingSync }
                : current,
            );
          }
        }
      } finally {
        removePending(action.id, pendingAction);
      }
    },
    [
      scope,
      account.accountAddress,
      actions,
      ensureTradingEnabled,
      isSpot,
      removePending,
      symbol,
      szDecimals,
    ],
  );

  return { canInteract, getLineId, onReferenceLineAction, pending };
}
