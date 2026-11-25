import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { atom, useAtomValue } from 'jotai';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useListStructureAtom,
  useRiskyListFrameAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { useTokenListContextData } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/atoms';
import {
  cell,
  ensureStoreProjection,
  meta,
  subcell,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells/projection';
import { useHomeTokenListOwnerKey } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells/useHomeTokenListOwnerKey';
import {
  canConvertFiat,
  convertFiat,
} from '@onekeyhq/kit/src/utils/fiatConvert';
import type {
  IDustSweepBannerHolding,
  IDustSweepBannerNetwork,
  IDustSweepBannerOffer,
} from '@onekeyhq/kit/src/views/DustSweep/utils/loadNetworks';
import {
  DUST_SWEEP_BANNER_MIN_COUNT,
  DUST_SWEEP_MAX_THRESHOLD,
  getDustSweepHiddenThreshold,
  isDustSweepEligibleToken,
} from '@onekeyhq/kit/src/views/DustSweep/utils/tokenEligibility';
import {
  useCurrencyPersistAtom,
  useDustSweepPreferencesPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isAgg } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import type { IDustSweepRouteParams } from '@onekeyhq/shared/types/swap/dustSweep';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

const NONE: IDustSweepBannerOffer = { count: 0, logos: [] };

// The networks the Home list says the banner could offer, largest balance
// first with their holdings: those where Dust sweep would preselect enough.
// The check only ever lowers a network's count, so no other network can.
type IBannerPlan = {
  key: string;
  networks: IDustSweepBannerNetwork[];
};

const NO_PLAN: IBannerPlan = { key: '', networks: [] };

// How many holdings Dust sweep preselects on the network the banner offers.
// Dust sweep works one network at a time, so the count is one network's:
// holdings under the Dust sweep amount setting and above the gas floor, by its
// token rules. The Home list proposes the networks; the offer then checks them
// against the Swap list the page uses, largest first, and takes the first with
// enough, where the page then opens. The banner waits for that. The logos are
// the three most valuable. Undefined networks (still loading, or no banner to
// show) count nothing.
export function useDustSweepBannerCount(
  supportedNetworkIds: ReadonlySet<string> | undefined,
): IDustSweepBannerOffer {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const store = useTokenListContextData().store!;
  const [listStructure] = useListStructureAtom();
  const [riskyFrame] = useRiskyListFrameAtom();
  const [{ threshold }] = useDustSweepPreferencesPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const ownerKey = useHomeTokenListOwnerKey();
  const {
    activeAccount: { account, wallet, indexedAccount, network },
  } = useActiveAccount({ num: 0 });
  // The structure can still hold the previous owner's rows after a switch.
  // Merge-derive mode keys it by the indexed account instead.
  const ownerMatches =
    listStructure.generation >= 0 &&
    (listStructure.ownerKey === ownerKey ||
      (!!indexedAccount?.id &&
        !!network?.id &&
        listStructure.ownerKey === `${indexedAccount.id}__${network.id}`));

  const planAtom = useMemo(() => {
    const { valuationUpdating } = ensureStoreProjection(store);
    let last = NO_PLAN;
    return atom((get) => {
      if (!supportedNetworkIds || !ownerMatches) return NO_PLAN;
      // Keep the last count until a valuation frame finishes writing.
      if (get(valuationUpdating)) return last;
      // Per network: the balance Dust sweep ranks networks by (regular and
      // small-balance rows), whether Dust sweep lists it at all (something
      // under its largest amount preset), and what it preselects.
      const networks = new Map<
        string,
        {
          balance: BigNumber;
          listed: boolean;
          preselected: { usd: BigNumber; logoURI?: string }[];
          holdings: IDustSweepBannerHolding[];
        }
      >();
      const toUsd = (fiat: ITokenFiat) => {
        // Home stores values in USD; convert any row that kept another basis.
        const source = fiat.currency ?? USD_CURRENCY_ID;
        if (source === USD_CURRENCY_ID) return new BigNumber(fiat.fiatValue);
        if (
          !canConvertFiat({
            sourceCurrency: source,
            targetCurrency: USD_CURRENCY_ID,
            currencyMap,
          })
        )
          return undefined;
        return new BigNumber(
          convertFiat({
            value: fiat.fiatValue,
            sourceCurrency: source,
            targetCurrency: USD_CURRENCY_ID,
            currencyMap,
          }),
        );
      };
      const consider = (
        token: IToken,
        fiat: ITokenFiat | undefined,
        risky: boolean,
      ) => {
        if (!fiat || !token.networkId) return;
        if (!supportedNetworkIds.has(token.networkId)) return;
        const usd = toUsd(fiat);
        if (!usd?.isFinite()) return;
        let entry = networks.get(token.networkId);
        if (!entry) {
          entry = {
            balance: new BigNumber(0),
            listed: false,
            preselected: [],
            holdings: [],
          };
          networks.set(token.networkId, entry);
        }
        if (!risky) entry.balance = entry.balance.plus(usd);
        if (
          !isDustSweepEligibleToken(token) ||
          !new BigNumber(fiat.balanceParsed ?? fiat.balance).gt(0) ||
          !usd.gt(0)
        )
          return;
        entry.holdings.push({
          contractAddress: token.address,
          symbol: token.symbol,
          decimals: token.decimals,
          logoURI: token.logoURI,
          valueUsd: usd.toFixed(),
          price: fiat.price?.toString(),
          riskLevel: token.riskLevel,
        });
        if (usd.lt(DUST_SWEEP_MAX_THRESHOLD)) entry.listed = true;
        if (
          usd.lt(threshold) &&
          !usd.lt(getDustSweepHiddenThreshold(token.networkId))
        ) {
          entry.preselected.push({ usd, logoURI: token.logoURI });
        }
      };
      for (const id of [
        ...listStructure.orderedIds,
        ...listStructure.smallBalanceIds,
      ]) {
        const rowMeta = get(meta(store, id));
        if (isAgg(id, rowMeta)) {
          // An All Networks row can merge one token across networks; Dust
          // sweep sees each network's holding. The owned list can name
          // networks Home never fetched, so follow the row's membership.
          const memberNetworks = new Set(listStructure.aggMembership[id]);
          for (const member of listStructure.ownedAggregateTokenListMap[id]
            ?.tokens ?? []) {
            if (member.networkId && memberNetworks.has(member.networkId)) {
              consider(
                member,
                get(subcell(store, id, member.networkId)),
                false,
              );
            }
          }
        } else if (rowMeta) {
          consider(rowMeta, get(cell(store, id)), false);
        }
      }
      if (riskyFrame.ownerKey === listStructure.ownerKey) {
        for (const token of riskyFrame.riskyTokens) {
          consider(token, riskyFrame.riskyMap[token.$key], true);
        }
      }
      // Networks Dust sweep lists that could offer enough, the largest first.
      const candidates = [...networks.entries()]
        .filter(
          ([, entry]) =>
            entry.listed &&
            entry.balance.decimalPlaces(2).gt(0) &&
            entry.preselected.length >= DUST_SWEEP_BANNER_MIN_COUNT,
        )
        .toSorted(([, a], [, b]) => b.balance.comparedTo(a.balance) ?? 0)
        .map(([networkId, entry]) => ({
          networkId,
          holdings: entry.holdings,
        }));
      // Cents keep a price tick from starting another check.
      const key = JSON.stringify([
        candidates.map(({ networkId, holdings }) => [
          networkId,
          holdings.map((holding) => [
            holding.contractAddress,
            new BigNumber(holding.valueUsd).toFixed(2),
            holding.price,
            holding.riskLevel,
          ]),
        ]),
      ]);
      if (key !== last.key) {
        last = { key, networks: candidates };
      }
      return last;
    });
  }, [
    store,
    listStructure,
    riskyFrame,
    supportedNetworkIds,
    ownerMatches,
    threshold,
    currencyMap,
  ]);
  const plan = useAtomValue(planAtom, { store });
  const params = useMemo<IDustSweepRouteParams | undefined>(
    () =>
      wallet?.id
        ? {
            accountId: account?.id,
            walletId: wallet.id,
            indexedAccountId: indexedAccount?.id,
            networkId: network?.isAllNetworks ? undefined : network?.id,
            entry: 'homeBanner',
          }
        : undefined,
    [
      account?.id,
      wallet?.id,
      indexedAccount?.id,
      network?.id,
      network?.isAllNetworks,
    ],
  );
  // A new account or amount setting waits for its own check; a Home refresh
  // keeps the last checked offer until the next one lands.
  const ownerCheckKey = JSON.stringify([threshold, params]);
  const { result } = usePromiseResult(
    async () => {
      // No network can offer enough without a request.
      if (!params || !plan.networks.length) {
        return { ownerCheckKey, offer: NONE };
      }
      const { loadDustSweepBannerOffer } =
        await import('@onekeyhq/kit/src/views/DustSweep/utils/loadNetworks');
      const offer = await loadDustSweepBannerOffer({
        params,
        networks: plan.networks,
        threshold,
      });
      return { ownerCheckKey, offer };
    },
    [ownerCheckKey, params, plan, threshold],
    { undefinedResultIfError: true },
  );
  if (!plan.networks.length || result?.ownerCheckKey !== ownerCheckKey) {
    return NONE;
  }
  return result.offer;
}
