import { useEffect, useMemo } from 'react';

import { useTabIsRefreshingFocused } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import { mapSnapshotToPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

const ACCOUNT_INVALIDATING_SUBTYPES = new Set<ESubscriptionType>([
  ESubscriptionType.WEB_DATA2,
  ESubscriptionType.USER_FILLS,
  ESubscriptionType.USER_NON_FUNDING_LEDGER_UPDATES,
  ESubscriptionType.OPEN_ORDERS,
  ESubscriptionType.SPOT_STATE,
]);

export function usePerpsHomePortfolio(): {
  viewState: 'ready' | 'loading' | 'empty';
  view: IPerpsHomeView | undefined;
} {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const accountId = account?.id;
  const indexedAccountId = account?.indexedAccountId;
  // Home tabs stay mounted while frozen, so gate polling on the Perps tab being active.
  const { isFocused: isTabFocused } = useTabIsRefreshingFocused();

  const { result, run } = usePromiseResult(
    async () => {
      if (!accountId && !indexedAccountId) {
        return { address: '', view: undefined };
      }
      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: PERPS_NETWORK_ID,
        });
      let address = '';
      try {
        const acc = await backgroundApiProxy.serviceAccount.getNetworkAccount({
          accountId: indexedAccountId ? undefined : accountId,
          indexedAccountId,
          deriveType: deriveType ?? 'default',
          networkId: PERPS_NETWORK_ID,
        });
        address = acc?.addressDetail?.normalizedAddress || acc?.address || '';
      } catch {
        // account has no Arbitrum derivation, so there is no HL address to query
        return { address: '', view: undefined };
      }
      if (!address) {
        return { address: '', view: undefined };
      }
      const snapshot =
        await backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
          { address },
        );
      return {
        address,
        view: snapshot ? mapSnapshotToPerpsHomeView(snapshot) : undefined,
      };
    },
    [accountId, indexedAccountId],
    {
      // Account-scoped so result swaps synchronously on account switch instead of rendering the previous account's portfolio.
      swrKey: `perps-home:${indexedAccountId ?? accountId ?? ''}`,
      // Poll interval matches the active TTL; the orchestrator gates real HL network to positions=15s / idle=1m / empty=30m.
      pollingInterval: PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS,
      overrideIsFocused: (isPageFocused) => isPageFocused && isTabFocused,
    },
  );

  // Refetch when Perps account data changes, the WS recovers, or a deposit confirms on-chain.
  useEffect(() => {
    const invalidateAndRun = () => {
      const address = result?.address;
      // Skip when the address is unresolved: a bare invalidate would wipe every account's cache.
      if (address) {
        void backgroundApiProxy.serviceHyperliquid
          .invalidateHyperliquidPortfolio(address)
          .then(() => run());
      } else {
        void run();
      }
    };
    const onHl = (p: { subType: ESubscriptionType }) => {
      if (ACCOUNT_INVALIDATING_SUBTYPES.has(p.subType)) invalidateAndRun();
    };
    const onRecover = () => invalidateAndRun();
    const onTxConfirmed = (p: { networkId: string }) => {
      if (p.networkId === PERPS_NETWORK_ID) invalidateAndRun();
    };
    appEventBus.on(EAppEventBusNames.HyperliquidDataUpdate, onHl);
    appEventBus.on(EAppEventBusNames.PerpsWebSocketRecovered, onRecover);
    appEventBus.on(EAppEventBusNames.LocalPendingTxConfirmed, onTxConfirmed);
    return () => {
      appEventBus.off(EAppEventBusNames.HyperliquidDataUpdate, onHl);
      appEventBus.off(EAppEventBusNames.PerpsWebSocketRecovered, onRecover);
      appEventBus.off(EAppEventBusNames.LocalPendingTxConfirmed, onTxConfirmed);
    };
  }, [result?.address, run]);

  const view = result?.view;
  const viewState = useMemo<'ready' | 'loading' | 'empty'>(() => {
    // result is undefined until a fetch resolves for the current account key (swrKey
    // resets it synchronously on switch), so an unresolved key reads as loading, not empty.
    if (result === undefined) return 'loading';
    return view && !view.isEmpty ? 'ready' : 'empty';
  }, [result, view]);

  return useMemo(() => ({ viewState, view }), [viewState, view]);
}
