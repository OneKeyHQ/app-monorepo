import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

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
  frequentlyUsedNetworks,
}: {
  networks: IServerNetwork[];
  searchKey: string;
  unavailableNetworks?: IServerNetwork[];
  frequentlyUsedNetworks?: IServerNetwork[];
}) {
  const intl = useIntl();
  const networkFuseSearch = useFuseSearch(networks);

  const tempFrequentlyUsedItemsSet = useMemo(
    () => new Set(frequentlyUsedNetworks?.map((o) => o.id)),
    [frequentlyUsedNetworks],
  );
  const filterFrequentlyUsedNetworks = useCallback(
    (inputs: IServerNetwork[]) =>
      inputs.filter((o) => !tempFrequentlyUsedItemsSet.has(o.id)),
    [tempFrequentlyUsedItemsSet],
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

    const data = filterFrequentlyUsedNetworks(mainnetItems).reduce(
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
      .sort((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));

    const _sections: IPureChainSelectorSectionListItem[] = [...mainnetSections];

    if (frequentlyUsedNetworks && frequentlyUsedNetworks.length > 0) {
      _sections.unshift({
        data: frequentlyUsedNetworks,
      });
    }

    if (testnetItems.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslations.global_testnet,
        }),
        data: filterFrequentlyUsedNetworks(testnetItems),
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
    filterFrequentlyUsedNetworks,
    networks,
    frequentlyUsedNetworks,
    unavailableNetworks,
    networkFuseSearch,
    intl,
  ]);

  return {
    sections,
  };
}
