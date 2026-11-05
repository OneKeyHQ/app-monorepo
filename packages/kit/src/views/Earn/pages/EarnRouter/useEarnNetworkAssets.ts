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
import {
  getEarnAssetType,
  listAssetSelectNetworks,
} from '../EarnAssetSelect/earnAssetSelect.utils';

import { listPayTokens } from './earnRouter.utils';

import type {
  IEarnDesktopHoldOffer,
  IEarnDesktopLendingOffer,
} from '../../components/desktopHome/earnDesktopHome.utils';
import type {
  IEarnAssetSelectNetwork,
  IEarnAssetSelectToken,
  IEarnAssetSelectTokenNetwork,
} from '../EarnAssetSelect/earnAssetSelect.utils';

const NO_NETWORK_IDS: string[] = [];
const NO_PROTOCOLS: IStakeProtocolListItem[] = [];
const NO_ASSETS: IEarnAvailableAsset[] = [];

export type IEarnNetworkAssets = {
  // Every token Earn pays on, as the selector lists them: once each, with
  // its figures on each network it is offered on
  tokens: IEarnAssetSelectToken[];
  // What each pays, the best rate first, keyed by lowercased symbol: on the
  // one network asked for, else on every network
  offersBySymbol: Map<string, IEarnDesktopHoldOffer[]>;
  // The networks Earn pays on, those the wallet holds any of first: the
  // selector's network column
  networks: IEarnAssetSelectNetwork[];
  networkById: Map<string, IEarnAssetSelectNetwork>;
  stableSymbols: Set<string>;
  // The one network asked for
  networkName?: string;
  networkLogoURI?: string;
  isLoaded: boolean;
};

/** The network an offer takes deposits on */
export const getOfferNetworkId = (offer: IEarnDesktopHoldOffer) =>
  offer.kind === 'lending'
    ? offer.offer.market.networkId
    : offer.item.network.networkId;

/** The network an offer takes deposits on, named, from the offer itself */
export const getOfferNetwork = (
  offer: IEarnDesktopHoldOffer,
): IEarnAssetSelectNetwork =>
  offer.kind === 'lending'
    ? {
        id: offer.offer.market.networkId,
        name: offer.offer.market.network.name,
        logoURI: offer.offer.market.network.logoURI,
      }
    : {
        id: offer.item.network.networkId,
        name: offer.item.network.name,
        logoURI: offer.item.network.logoURI,
      };

type IHeldOnNetwork = {
  amount: BigNumber;
  fiatValueUsd: BigNumber;
  name: string;
  logoURI: string;
  address: string;
  isNative: boolean;
};

/**
 * Everything Earn pays on, token by token: the full protocol list (one
 * request the Protocols page shares) and the lending markets' supply, with
 * what the wallet holds of each. Given a network, that network's alone; else
 * every network, each token once with its figures per network (11-05: Pay
 * with bridges what the wallet holds elsewhere). The deposit modal's
 * selector lists it, and comparing a kind of token reads its offers from it
 */
export function useEarnNetworkAssets({
  networkId,
  enabled = true,
}: {
  // Unset: every network
  networkId?: string;
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
  // Earn lists here is asked for, as the Protocols page falls back
  const assetSymbolsKey = useMemo(
    () =>
      Array.from(
        new Set(
          assets
            .filter((asset) =>
              asset.protocols.some(
                (item) => !networkId || item.networkId === networkId,
              ),
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
    async () =>
      networkId
        ? backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId })
        : undefined,
    [networkId],
  );
  // The wallet on the network, read fresh unless the home just did; across
  // every network as the home last read it
  const refreshNetworkIds = useMemo(
    () => (networkId ? [networkId] : NO_NETWORK_IDS),
    [networkId],
  );
  const wallet = useEarnDesktopWalletHoldings({
    isActive: enabled,
    refreshNetworkIds,
  });
  // What the wallet holds, by lowercased symbol, then network
  const held = useMemo(() => {
    const bySymbol = new Map<string, Map<string, IHeldOnNetwork>>();
    wallet.networkGroups.forEach((group) => {
      if (networkId && group.networkId !== networkId) {
        return;
      }
      listPayTokens({ group, depositSymbol: '' }).forEach((item) => {
        const key = item.token.symbol.toLowerCase();
        const byNetwork =
          bySymbol.get(key) ?? new Map<string, IHeldOnNetwork>();
        const kept = byNetwork.get(group.networkId);
        byNetwork.set(group.networkId, {
          amount: (kept?.amount ?? new BigNumber(0)).plus(item.amount),
          fiatValueUsd: (kept?.fiatValueUsd ?? new BigNumber(0)).plus(
            item.fiatValueUsd,
          ),
          name: kept?.name || item.token.name,
          logoURI: kept?.logoURI || item.token.logoURI || '',
          address: kept?.address || item.token.address,
          isNative: kept?.isNative ?? Boolean(item.token.isNative),
        });
        bySymbol.set(key, byNetwork);
      });
    });
    return bySymbol;
  }, [networkId, wallet.networkGroups]);

  return useMemo(() => {
    const isInScope = (id: string) => !networkId || id === networkId;
    const inScope = protocols.filter(
      (item) => item.symbol && isInScope(item.network.networkId),
    );
    // Each symbol's protocol rows, then the networks they are on
    const protocolsBySymbol = new Map<string, IStakeProtocolListItem[]>();
    inScope.forEach((item) => {
      const key = (item.symbol ?? '').toLowerCase();
      protocolsBySymbol.set(key, [...(protocolsBySymbol.get(key) ?? []), item]);
    });
    const lendingInScope = new Map<string, IEarnDesktopLendingOffer[]>();
    lendingOffers.forEach((offers, key) => {
      const kept = offers.filter((offer) => isInScope(offer.market.networkId));
      if (kept.length) {
        lendingInScope.set(key, kept);
      }
    });
    const symbols = new Set<string>([
      ...protocolsBySymbol.keys(),
      ...lendingInScope.keys(),
    ]);
    const assetBySymbol = new Map(
      assets.map((asset) => [asset.symbol.toLowerCase(), asset]),
    );
    const offersBySymbol = new Map<string, IEarnDesktopHoldOffer[]>();
    const tokens: IEarnAssetSelectToken[] = [];
    symbols.forEach((key) => {
      const symbolProtocols = protocolsBySymbol.get(key) ?? [];
      const lending = lendingInScope.get(key) ?? [];
      const networkIds = new Set<string>([
        ...symbolProtocols.map((item) => item.network.networkId),
        ...lending.map((offer) => offer.market.networkId),
      ]);
      const offers: IEarnDesktopHoldOffer[] = [];
      const networks: IEarnAssetSelectTokenNetwork[] = [];
      const inWallet = held.get(key);
      const addresses: IEarnAssetSelectToken['addresses'] = [];
      networkIds.forEach((id) => {
        const onNetwork = collectNetworkOffers({
          networkId: id,
          protocols: symbolProtocols,
          lendingOffers: lending,
        });
        if (!onNetwork.length) {
          return;
        }
        offers.push(...onNetwork);
        const named = getOfferNetwork(onNetwork[0]);
        const heldHere = inWallet?.get(id);
        networks.push({
          ...named,
          rate: onNetwork[0].apr,
          balance: heldHere?.amount.gt(0)
            ? heldHere.amount.toFixed()
            : undefined,
          fiatValue: heldHere?.fiatValueUsd.gt(0)
            ? heldHere.fiatValueUsd.toNumber()
            : undefined,
        });
        const address =
          (heldHere && !heldHere.isNative ? heldHere.address : undefined) ||
          lending.find(
            (offer) => offer.market.networkId === id && offer.tokenAddress,
          )?.tokenAddress;
        if (address) {
          addresses.push({ networkId: id, address: address.toLowerCase() });
        }
      });
      if (!offers.length) {
        return;
      }
      offers.sort((a, b) => b.apr - a.apr);
      offersBySymbol.set(key, offers);
      const asset = assetBySymbol.get(key);
      const anyHeld = inWallet ? [...inWallet.values()][0] : undefined;
      const symbol =
        symbolProtocols[0]?.symbol ??
        lending[0]?.symbol ??
        asset?.symbol ??
        key.toUpperCase();
      // The wallet's total where Earn offers it
      let balance = new BigNumber(0);
      let fiatValue = 0;
      networks.forEach((item) => {
        balance = balance.plus(item.balance ?? 0);
        fiatValue += item.fiatValue ?? 0;
      });
      tokens.push({
        symbol,
        name: anyHeld?.name || lending[0]?.tokenName || asset?.name || symbol,
        logoURI:
          anyHeld?.logoURI || asset?.logoURI || lending[0]?.logoURI || '',
        type: getEarnAssetType(symbol, stableSymbols),
        networks: networks.toSorted((a, b) => (b.rate ?? 0) - (a.rate ?? 0)),
        addresses,
        rate: offers[0]?.apr,
        balance: balance.gt(0) ? balance.toFixed() : undefined,
        fiatValue: fiatValue > 0 ? fiatValue : undefined,
      });
    });
    const networks = listAssetSelectNetworks(tokens);
    return {
      tokens,
      offersBySymbol,
      networks,
      networkById: new Map(networks.map((item) => [item.id, item])),
      stableSymbols,
      networkName: network?.name,
      networkLogoURI: network?.logoURI,
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
