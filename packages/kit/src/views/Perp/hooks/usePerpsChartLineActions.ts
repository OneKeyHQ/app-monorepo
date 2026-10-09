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
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<Record<string, { price?: number }>>(
    {},
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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

      inFlight.current.add(action.id);
      setPending((current) => ({
        ...current,
        [action.id]: { price: newPrice ? Number(newPrice) : undefined },
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
        }
      } finally {
        inFlight.current.delete(action.id);
        if (mounted.current) {
          setPending((current) => {
            const next = { ...current };
            delete next[action.id];
            return next;
          });
        }
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
