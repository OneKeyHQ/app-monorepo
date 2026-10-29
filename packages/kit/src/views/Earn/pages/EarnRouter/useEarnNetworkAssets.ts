import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useEarnAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import {
  collectLendingOffers,
  collectNetworkOffers,
} from '../../components/desktopHome/earnDesktopHome.utils';
import {
  useEarnDesktopMarkets,
  useEarnDesktopWalletHoldings,
} from '../../components/desktopHome/useEarnDesktopHomeData';
import { getEarnAssetType } from '../EarnAssetSelect/earnAssetSelect.utils';

import { listPayTokens } from './earnRouter.utils';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';
import type { IEarnAssetSelectToken } from '../EarnAssetSelect/earnAssetSelect.utils';

const NO_NETWORK_IDS: string[] = [];
const NO_PROTOCOLS: IStakeProtocolListItem[] = [];
const NO_ASSETS: IEarnAvailableAsset[] = [];

export type IEarnNetworkAssets = {
  // Every token Earn pays on here, as the selector lists them
  tokens: IEarnAssetSelectToken[];
  // What each pays here, the best rate first, keyed by lowercased symbol
  offersBySymbol: Map<string, IEarnDesktopHoldOffer[]>;
  stableSymbols: Set<string>;
  networkName?: string;
  isLoaded: boolean;
};

/**
 * Everything Earn pays on one network, token by token: the full protocol list
 * (one request the Protocols page shares) and the lending markets' supply,
 * with what the wallet holds of each. The deposit modal's selector lists it,
 * and comparing a kind of token reads its offers from it
 */
export function useEarnNetworkAssets({
  networkId,
  enabled = true,
}: {
  networkId: string;
  enabled?: boolean;
}): IEarnNetworkAssets {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount.account?.id;
  const accountNetworkId = activeAccount.network?.id;
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  const assets = useMemo(
    () =>
      Object.values(availableAssetsByType).flatMap((list) => list ?? NO_ASSETS),
    [availableAssetsByType],
  );

  // The full list in one answer; where the server can't give it, each token
  // Earn lists on this network is asked for, as the Protocols page falls back
  const assetSymbolsKey = useMemo(
    () =>
      Array.from(
        new Set(
          assets
            .filter((asset) =>
              asset.protocols.some((item) => item.networkId === networkId),
            )
            .map((asset) => asset.symbol),
        ),
      )
        .toSorted()
        .join(','),
    [assets, networkId],
  );
  const { result: protocols = NO_PROTOCOLS } = usePromiseResult(async () => {
    if (!enabled) {
      return NO_PROTOCOLS;
    }
    const all = await backgroundApiProxy.serviceStaking
      .getAllProtocolList()
      .catch(() => NO_PROTOCOLS);
    if (all.length) {
      return all;
    }
    const symbols = assetSymbolsKey ? assetSymbolsKey.split(',') : [];
    const lists = await Promise.all(
      symbols.map((symbol) =>
        backgroundApiProxy.serviceStaking
          .getProtocolList({ symbol, accountId, networkId: accountNetworkId })
          .then((items) => items.map((item) => ({ ...item, symbol })))
          .catch(() => NO_PROTOCOLS),
      ),
    );
    return lists.flat();
  }, [accountId, accountNetworkId, assetSymbolsKey, enabled]);

  const { markets, isLoaded: isMarketsLoaded } = useEarnDesktopMarkets({
    isActive: enabled,
  });
  const lendingOffers = useMemo(
    () => collectLendingOffers({ markets }),
    [markets],
  );
  const { result: stableAssets } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: EAvailableAssetsTypeEnum.StableCoins,
      }),
    [],
    { undefinedResultIfError: true },
  );
  const stableSymbols = useMemo(
    () =>
      new Set((stableAssets ?? []).map((asset) => asset.symbol.toUpperCase())),
    [stableAssets],
  );
  const { result: network } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
    [networkId],
  );
  // The wallet on this network, read fresh unless the home just did
  const refreshNetworkIds = useMemo(
    () => (networkId ? [networkId] : NO_NETWORK_IDS),
    [networkId],
  );
  const wallet = useEarnDesktopWalletHoldings({
    isActive: enabled,
    refreshNetworkIds,
  });
  const held = useMemo(() => {
    const group = wallet.networkGroups.find(
      (item) => item.networkId === networkId,
    );
    const bySymbol = new Map<
      string,
      {
        amount: BigNumber;
        fiatValueUsd: BigNumber;
        name: string;
        logoURI: string;
        address: string;
        isNative: boolean;
      }
    >();
    listPayTokens({ group, depositSymbol: '' }).forEach((item) => {
      const key = item.token.symbol.toLowerCase();
      const kept = bySymbol.get(key);
      bySymbol.set(key, {
        amount: (kept?.amount ?? new BigNumber(0)).plus(item.amount),
        fiatValueUsd: (kept?.fiatValueUsd ?? new BigNumber(0)).plus(
          item.fiatValueUsd,
        ),
        name: kept?.name || item.token.name,
        logoURI: kept?.logoURI || item.token.logoURI || '',
        address: kept?.address || item.token.address,
        isNative: kept?.isNative ?? Boolean(item.token.isNative),
      });
    });
    return bySymbol;
  }, [networkId, wallet.networkGroups]);

  return useMemo(() => {
    const onNetwork = protocols.filter(
      (item) => item.network.networkId === networkId && item.symbol,
    );
    const protocolsBySymbol = new Map<string, IStakeProtocolListItem[]>();
    onNetwork.forEach((item) => {
      const key = (item.symbol ?? '').toLowerCase();
      protocolsBySymbol.set(key, [...(protocolsBySymbol.get(key) ?? []), item]);
    });
    const symbols = new Set<string>(protocolsBySymbol.keys());
    lendingOffers.forEach((offers, key) => {
      if (offers.some((offer) => offer.market.networkId === networkId)) {
        symbols.add(key);
      }
    });
    const assetBySymbol = new Map(
      assets.map((asset) => [asset.symbol.toLowerCase(), asset]),
    );
    const offersBySymbol = new Map<string, IEarnDesktopHoldOffer[]>();
    const tokens: IEarnAssetSelectToken[] = [];
    symbols.forEach((key) => {
      const lending = (lendingOffers.get(key) ?? []).filter(
        (offer) => offer.market.networkId === networkId,
      );
      const offers = collectNetworkOffers({
        networkId,
        protocols: protocolsBySymbol.get(key) ?? [],
        lendingOffers: lending,
      });
      if (!offers.length) {
        return;
      }
      offersBySymbol.set(key, offers);
      const asset = assetBySymbol.get(key);
      const inWallet = held.get(key);
      const symbol =
        protocolsBySymbol.get(key)?.[0]?.symbol ??
        lending[0]?.symbol ??
        asset?.symbol ??
        key.toUpperCase();
      const address =
        (inWallet && !inWallet.isNative ? inWallet.address : undefined) ||
        lending.find((offer) => offer.tokenAddress)?.tokenAddress;
      tokens.push({
        symbol,
        name: inWallet?.name || lending[0]?.tokenName || asset?.name || symbol,
        logoURI:
          inWallet?.logoURI || asset?.logoURI || lending[0]?.logoURI || '',
        type: getEarnAssetType(symbol, stableSymbols),
        networks: network
          ? [{ id: network.id, name: network.name, logoURI: network.logoURI }]
          : [],
        addresses: address
          ? [{ networkId, address: address.toLowerCase() }]
          : [],
        rate: offers[0]?.apr,
        balance: inWallet?.amount.gt(0) ? inWallet.amount.toFixed() : undefined,
        fiatValue: inWallet?.fiatValueUsd.gt(0)
          ? inWallet.fiatValueUsd.toNumber()
          : undefined,
      });
    });
    return {
      tokens,
      offersBySymbol,
      stableSymbols,
      networkName: network?.name,
      isLoaded: protocols !== NO_PROTOCOLS && isMarketsLoaded,
    };
  }, [
    assets,
    held,
    isMarketsLoaded,
    lendingOffers,
    network,
    networkId,
    protocols,
    stableSymbols,
  ]);
}
