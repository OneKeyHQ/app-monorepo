import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isUndefined } from 'lodash';
import { useIntl } from 'react-intl';

import { NETWORK_SHOW_VALUE_THRESHOLD_USD } from '@onekeyhq/shared/src/consts/networkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useFuseSearch } from './useFuseSearch';

import type {
  IPureChainSelectorSectionListItem,
  IServerNetworkMatch,
} from '../types';

export function usePureChainSelectorSections({
  networks,
  searchKey,
  unavailableNetworks,
  accountNetworkValues,
  accountDeFiOverview,
}: {
  networks: IServerNetwork[];
  searchKey: string;
  unavailableNetworks?: IServerNetwork[];
  accountNetworkValues?: Record<string, string>;
  accountDeFiOverview?: Record<string, { netWorth: number }>;
}) {
  const intl = useIntl();
  const networkFuseSearch = useFuseSearch(networks);

  const getNetworkValue = useCallback(
    (networkId: string) => {
      if (isUndefined(accountNetworkValues?.[networkId])) {
        return '0';
      }

      const tokenValue = accountNetworkValues?.[networkId] ?? '0';
      const defiValue = accountDeFiOverview?.[networkId]?.netWorth ?? 0;
      return new BigNumber(tokenValue).plus(defiValue).toFixed();
    },
    [accountNetworkValues, accountDeFiOverview],
  );

  const sections = useMemo<IPureChainSelectorSectionListItem[]>(() => {
    if (searchKey) {
      const data = networkFuseSearch(searchKey);
      return data.length === 0
        ? []
        : [
            {
              data,
            },
          ];
    }
    const testnetItems: IServerNetworkMatch[] = [];
    const mainnetItems: IServerNetworkMatch[] = [];
    for (let i = 0; i < networks.length; i += 1) {
      const item = networks[i];
      if (item.isTestnet) {
        testnetItems.push(item);
      } else {
        mainnetItems.push(item);
      }
    }

    // Separate networks with values from those without
    // Check ALL mainnetItems, not filtered ones
    const networksWithValue: IServerNetworkMatch[] = [];
    const networksWithoutValue: IServerNetworkMatch[] = [];
    let totalValue = new BigNumber(0);

    for (const network of mainnetItems) {
      const value = getNetworkValue(network.id);
      if (new BigNumber(value).gt(NETWORK_SHOW_VALUE_THRESHOLD_USD)) {
        networksWithValue.push(network);
        totalValue = totalValue.plus(value);
      } else {
        networksWithoutValue.push(network);
      }
    }

    // Sort networks with value by value descending
    networksWithValue.sort((a, b) => {
      const valueA = new BigNumber(getNetworkValue(a.id));
      const valueB = new BigNumber(getNetworkValue(b.id));
      return valueB.minus(valueA).toNumber();
    });

    const data = networksWithoutValue.reduce(
      (result, item) => {
        const char = item.name[0].toUpperCase();
        if (!result[char]) {
          result[char] = [];
        }
        result[char].push(item);

        return result;
      },
      {} as Record<string, IServerNetwork[]>,
    );

    const mainnetSections = Object.entries(data)
      .map(([key, value]) => ({ title: key, data: value }))
      .toSorted((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));

    const _sections: IPureChainSelectorSectionListItem[] = [...mainnetSections];

    // Add networks with value section at the top
    if (networksWithValue.length > 0) {
      _sections.unshift({
        title: intl.formatMessage({
          id: ETranslations.network_found_assets_on_networks,
        }),
        data: networksWithValue,
        totalValue: totalValue.toFixed(),
      });
    }

    if (testnetItems.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslations.global_testnet,
        }),
        data: testnetItems,
      });
    }

    if (unavailableNetworks && unavailableNetworks.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslations.network_selector_unavailable_networks,
        }),
        data: unavailableNetworks,
        isUnavailable: true,
      });
    }

    return _sections;
  }, [
    searchKey,
    networks,
    unavailableNetworks,
    networkFuseSearch,
    intl,
    getNetworkValue,
  ]);

  return {
    sections,
  };
}
