import { useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { buildHoldRows } from './earnDesktopHome.utils';
import { useContentStable } from './useContentStable';

import type {
  IEarnDesktopHoldRow,
  IEarnDesktopLendingOffer,
  IEarnDesktopWalletNetworkGroup,
} from './earnDesktopHome.utils';

type IProtocolLists = {
  key: string;
  bySymbol: Map<string, IStakeProtocolListItem[]>;
};

const EMPTY_ROWS: IEarnDesktopHoldRow[] = [];

/**
 * What the wallet holds, a row per token over every network it sits on, with
 * what Earn offers for it on any network the wallet has an account on. The
 * protocol list is asked once per held symbol, the call the table makes when
 * a token opens; it covers every network.
 */
export function useEarnDesktopHoldRows({
  networkGroups,
  accountNetworkIds,
  trendingAssets,
  fixedRateAssets,
  lendingOffers,
  isActive,
  isReady,
}: {
  networkGroups: IEarnDesktopWalletNetworkGroup[];
  /** The networks the wallet has an account on */
  accountNetworkIds: string[];
  trendingAssets: IEarnAvailableAsset[];
  fixedRateAssets: IEarnAvailableAsset[];
  lendingOffers: Map<string, IEarnDesktopLendingOffer[]>;
  isActive: boolean;
  /** The wallet, the Earn lists and the markets have all answered */
  isReady: boolean;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount.account?.id;
  const accountNetworkId = activeAccount.network?.id;
  const assets = useMemo(
    () => [...trendingAssets, ...fixedRateAssets],
    [fixedRateAssets, trendingAssets],
  );

  const symbols = useMemo(() => {
    const listed = new Map(
      assets.map((asset) => [asset.symbol.toLowerCase(), asset.symbol]),
    );
    const held = new Set<string>();
    networkGroups.forEach(({ tokens }) =>
      tokens.forEach((token) => {
        const symbol = listed.get(token.symbol.toLowerCase());
        if (symbol) {
          held.add(symbol);
        }
      }),
    );
    return Array.from(held).toSorted();
  }, [assets, networkGroups]);
  const listsKey = `${accountId ?? ''}|${symbols.join(',')}`;

  const listsRef = useRef<IProtocolLists | undefined>(undefined);
  const { result: lists } = usePromiseResult(async () => {
    // The rows stay as they were while the page is in the background
    if (!isActive && listsRef.current) {
      return listsRef.current;
    }
    const entries = await Promise.all(
      symbols.map(async (symbol) => {
        const list = await backgroundApiProxy.serviceStaking
          .getProtocolList({
            symbol,
            accountId,
            networkId: accountNetworkId,
          })
          .catch(() => [] as IStakeProtocolListItem[]);
        return [symbol.toLowerCase(), list] as const;
      }),
    );
    const next: IProtocolLists = {
      key: listsKey,
      bySymbol: new Map(entries),
    };
    listsRef.current = next;
    return next;
  }, [accountId, accountNetworkId, isActive, listsKey, symbols]);

  const builtRows = useMemo(
    () =>
      lists
        ? buildHoldRows({
            groups: networkGroups,
            assets,
            protocolsBySymbol: lists.bySymbol,
            lendingOffers,
            accountNetworkIds,
          })
        : EMPTY_ROWS,
    [accountNetworkIds, assets, lendingOffers, lists, networkGroups],
  );
  // The protocol lists are asked again when the page comes back into focus
  const rows = useContentStable(builtRows);

  return {
    rows,
    // A list for an older set of symbols would show the wrong rows
    isLoaded: isReady && lists?.key === listsKey,
  };
}
