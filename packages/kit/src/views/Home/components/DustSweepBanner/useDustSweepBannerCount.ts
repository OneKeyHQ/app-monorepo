import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { atom, useAtomValue } from 'jotai';

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
import {
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
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

type IBannerCount = { count: number; logos: (string | undefined)[] };

const NONE: IBannerCount = { count: 0, logos: [] };

// How many holdings Dust sweep preselects when it opens, read from the Home
// list already loaded. Dust sweep works one network at a time and opens on
// the account's largest network that has something to sweep, so the count is
// that network's: holdings under the Dust sweep amount setting and above the
// gas floor, by its token rules. The logos are the three most valuable.
// Undefined networks (still loading, or no banner to show) count nothing.
export function useDustSweepBannerCount(
  supportedNetworkIds: ReadonlySet<string> | undefined,
): IBannerCount {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const store = useTokenListContextData().store!;
  const [listStructure] = useListStructureAtom();
  const [riskyFrame] = useRiskyListFrameAtom();
  const [{ threshold }] = useDustSweepPreferencesPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const ownerKey = useHomeTokenListOwnerKey();
  const {
    activeAccount: { indexedAccount, network },
  } = useActiveAccount({ num: 0 });
  // The structure can still hold the previous owner's rows after a switch.
  // Merge-derive mode keys it by the indexed account instead.
  const ownerMatches =
    listStructure.generation >= 0 &&
    (listStructure.ownerKey === ownerKey ||
      (!!indexedAccount?.id &&
        !!network?.id &&
        listStructure.ownerKey === `${indexedAccount.id}__${network.id}`));

  const countAtom = useMemo(() => {
    const { valuationUpdating } = ensureStoreProjection(store);
    let last = NONE;
    return atom((get) => {
      if (!supportedNetworkIds || !ownerMatches) return NONE;
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
          };
          networks.set(token.networkId, entry);
        }
        if (!risky) entry.balance = entry.balance.plus(usd);
        if (
          !isDustSweepEligibleToken(
            token,
            fiat.balanceMultiplier ?? token.balanceMultiplier,
          ) ||
          !new BigNumber(fiat.balanceParsed ?? fiat.balance).gt(0) ||
          !usd.gt(0)
        )
          return;
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
      // The network Dust sweep opens on: the largest one it lists.
      let opening:
        | {
            balance: BigNumber;
            preselected: { usd: BigNumber; logoURI?: string }[];
          }
        | undefined;
      for (const entry of networks.values()) {
        if (
          entry.listed &&
          entry.balance.decimalPlaces(2).gt(0) &&
          (!opening || entry.balance.gt(opening.balance))
        ) {
          opening = entry;
        }
      }
      const found = (opening?.preselected ?? []).toSorted(
        (a, b) => b.usd.comparedTo(a.usd) ?? 0,
      );
      const logos = found.slice(0, 3).map((item) => item.logoURI);
      if (
        found.length !== last.count ||
        logos.some((logo, index) => logo !== last.logos[index])
      ) {
        last = { count: found.length, logos };
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
  return useAtomValue(countAtom, { store });
}
