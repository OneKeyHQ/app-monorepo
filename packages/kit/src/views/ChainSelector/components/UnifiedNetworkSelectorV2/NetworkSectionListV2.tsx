import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Empty,
  SearchBar,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { NETWORK_SHOW_VALUE_THRESHOLD_USD } from '@onekeyhq/shared/src/consts/networkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAppSWRCacheScopes } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useFuseSearch } from '../../hooks/useFuseSearch';
import { ChainSelectorTestIDs } from '../../testIDs';
import RecentNetworks from '../RecentNetworks';

import {
  getNetworkValueV2,
  useNetworkListPresentationV2,
} from './useNetworkListPresentationV2';
import { useNetworkTooltipV2 } from './useNetworkTooltipV2';

import type { IServerNetworkMatch } from '../../types';
import type {
  IdentityRow,
  NativeListRef,
  NativeListSnapshot,
  RowActionEvent,
  RowModel,
  TrailingAccessory,
} from '@onekeyfe/react-native-native-list';

type INetworkSectionV2 = {
  key: string;
  title?: string;
  data: IServerNetworkMatch[];
  unavailable?: boolean;
};

type INetworkSectionListPropsV2 = {
  recentNetworksEnabled?: boolean;
  accountNetworkValues: Record<string, string>;
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  unavailableItems: IServerNetwork[];
  frequentlyUsedItems: IServerNetwork[];
  allNetworkItem?: IServerNetwork;
  networkId?: string;
  walletId?: string;
  accountId?: string;
  indexedAccountId?: string;
  onPressItem?: (network: IServerNetwork) => void;
  onEditCustomNetwork?: (network: IServerNetwork) => void;
  accountNetworkValueCurrency?: string;
  accountDeFiOverview: Record<string, { netWorth: number }>;
  showAllNetworkInRecentNetworks?: boolean;
  zeroValue?: boolean;
  searchText?: string;
  setSearchText?: Dispatch<SetStateAction<string>>;
};

const LIST_STYLE_V2 = { flex: 1 };

export function NetworkSectionListV2({
  recentNetworksEnabled,
  walletId,
  accountId,
  accountNetworkValues,
  accountNetworkValueCurrency,
  mainnetItems,
  testnetItems,
  frequentlyUsedItems,
  unavailableItems,
  onPressItem,
  onEditCustomNetwork,
  networkId,
  allNetworkItem,
  accountDeFiOverview,
  showAllNetworkInRecentNetworks,
  zeroValue,
  searchText: searchTextProp,
  setSearchText: setSearchTextProp,
}: INetworkSectionListPropsV2) {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const [searchTextLocal, setSearchTextLocal] = useState('');
  const searchText = searchTextProp ?? searchTextLocal;
  const setSearchText = setSearchTextProp ?? setSearchTextLocal;
  const listRef = useRef<NativeListRef>(null);
  const {
    containerRef,
    showTooltip,
    closeTooltip,
    onActionAnchorInvalidated,
    tooltipElement,
  } = useNetworkTooltipV2(listRef);
  const { nativeTheme, formatCurrencyValue, getNetworkLeading } =
    useNetworkListPresentationV2(accountNetworkValueCurrency);

  const availableNetworks = useMemo(
    () => [
      ...mainnetItems,
      ...testnetItems,
      ...(allNetworkItem ? [allNetworkItem] : []),
    ],
    [allNetworkItem, mainnetItems, testnetItems],
  );
  const networksToSearch = useMemo(
    () => [
      ...(allNetworkItem ? [allNetworkItem] : []),
      ...mainnetItems,
      ...testnetItems,
    ],
    [allNetworkItem, mainnetItems, testnetItems],
  );
  const networkFuseSearch = useFuseSearch(networksToSearch);

  const sections = useMemo<INetworkSectionV2[]>(() => {
    if (searchText) {
      const data = networkFuseSearch(searchText);
      return data.length ? [{ key: 'network-search', data }] : [];
    }
    const frequentlyUsedIds = new Set(
      frequentlyUsedItems.map((item) => item.id),
    );
    const groups = mainnetItems.reduce<Record<string, IServerNetwork[]>>(
      (result, item) => {
        if (!frequentlyUsedIds.has(item.id)) {
          const letter = item.name[0].toUpperCase();
          (result[letter] ??= []).push(item);
        }
        return result;
      },
      {},
    );
    const result: INetworkSectionV2[] = [
      { key: 'network-frequently-used', data: frequentlyUsedItems },
      ...Object.entries(groups)
        .toSorted(([a], [b]) => a.charCodeAt(0) - b.charCodeAt(0))
        .map(([title, data]) => ({
          key: `network-letter-${title}`,
          title,
          data,
        })),
    ];
    if (testnetItems.length) {
      result.push({
        key: 'network-testnets',
        title: intl.formatMessage({ id: ETranslations.global_testnet }),
        data: testnetItems.filter((item) => !frequentlyUsedIds.has(item.id)),
      });
    }
    if (unavailableItems.length) {
      result.push({
        key: 'network-unavailable',
        title: intl.formatMessage({
          id: ETranslations.network_selector_unavailable_networks,
        }),
        data: unavailableItems,
        unavailable: true,
      });
    }
    return result;
  }, [
    frequentlyUsedItems,
    intl,
    mainnetItems,
    networkFuseSearch,
    searchText,
    testnetItems,
    unavailableItems,
  ]);

  const buildNetworkRow = useCallback(
    (
      network: IServerNetwork,
      sectionKey: string,
      disabled = false,
    ): IdentityRow => {
      const value = getNetworkValueV2({
        network,
        accountNetworkValues,
        accountDeFiOverview,
      });
      const trailing: TrailingAccessory[] = [];
      if (network.isCustomNetwork && !disabled) {
        trailing.push({
          kind: 'icon',
          name: 'PencilOutline',
          actionKey: 'network.edit',
          hoverActionKey: 'network.tooltip.edit',
          accessibilityLabel: intl.formatMessage({
            id: ETranslations.global_edit,
          }),
        });
      }
      if (new BigNumber(value).gt(NETWORK_SHOW_VALUE_THRESHOLD_USD)) {
        trailing.push({ kind: 'value', ...formatCurrencyValue(value) });
      }
      const title = network.isAllNetworks
        ? intl.formatMessage({ id: ETranslations.global_all_networks })
        : network.name;
      return {
        type: 'identity',
        presentation: 'networkSelector',
        height: 48,
        key: network.id,
        testID: network.id,
        sectionKey,
        groupId: network.id,
        groupPosition: 'single',
        size: 'small',
        title,
        // V1's EditableListItem overrides ListItem.Text with a plain title.
        // Search highlights belong to the portfolio list only.
        leading: getNetworkLeading(network),
        trailing,
        disabled,
        selected: networkId === network.id,
        accessibilityLabel: title,
      };
    },
    [
      accountDeFiOverview,
      accountNetworkValues,
      formatCurrencyValue,
      getNetworkLeading,
      intl,
      networkId,
    ],
  );

  const rows = useMemo<RowModel[]>(() => {
    const result: RowModel[] = [];
    if (!searchText) {
      if (!zeroValue) {
        result.push({
          type: 'sectionHeader',
          key: 'network-assets-description',
          sectionKey: 'network-frequently-used',
          presentation: 'networkSelector',
          height: 47,
          sticky: false,
          title: intl.formatMessage({
            id: ETranslations.network_found_assets_on_networks,
          }),
          titleActionKey: 'network.tooltip.assets',
          titleActionOnHover: true,
        });
      }
      if (allNetworkItem) {
        result.push(buildNetworkRow(allNetworkItem, 'network-frequently-used'));
      }
    }
    sections.forEach((section, sectionIndex) => {
      if (sectionIndex) {
        result.push({
          type: 'system',
          variant: 'spacer',
          key: `${section.key}-spacer`,
          sectionKey: section.key,
          height: 20,
        });
      }
      if (section.title) {
        result.push({
          type: 'sectionHeader',
          key: `${section.key}-header`,
          presentation: 'networkSelector',
          sectionKey: section.key,
          title: section.title,
          indexTitle: section.key.startsWith('network-letter-')
            ? section.title
            : undefined,
          height: 36,
        });
      }
      result.push(
        ...section.data.map((network) =>
          buildNetworkRow(network, section.key, section.unavailable),
        ),
      );
    });
    return result;
  }, [allNetworkItem, buildNetworkRow, intl, searchText, sections, zeroValue]);

  const initialScrollKey = useMemo(() => {
    if (searchText.trim()) return undefined;
    let precedingItems = 0;
    for (const section of sections) {
      const itemIndex = section.data.findIndex((item) => item.id === networkId);
      if (itemIndex !== -1) {
        const index = Math.max(0, itemIndex - (section.title ? 1 : 0));
        if (precedingItems + index <= 7) return rows[0]?.key;
        if (section.title && index === 0) return `${section.key}-header`;
        return section.data[Math.max(0, index - 1)]?.id;
      }
      precedingItems += section.data.length;
    }
    return undefined;
  }, [networkId, rows, searchText, sections]);

  const snapshot = useMemo<NativeListSnapshot>(
    () => ({
      schemaVersion: 1,
      generation: 1,
      theme: nativeTheme,
      layout: {
        kind: 'sectioned',
        stickyHeaders: true,
        contentPaddingHorizontal: 8,
        contentPaddingTop: 0,
        contentPaddingBottom: bottom || 8,
        itemSpacing: 0,
      },
      rows,
      capabilities: {
        sectionIndex: {
          enabled: !searchText,
          centeredInWindow: platformEnv.isNative || platformEnv.isDesktop,
        },
      },
      selection: { mode: 'none', selectedKeys: [] },
    }),
    [bottom, nativeTheme, rows, searchText],
  );

  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      if (
        event.actionKey === 'network.tooltip.assets' ||
        event.actionKey === 'network.tooltip.edit'
      ) {
        showTooltip(event);
        return;
      }
      const section = sections.find((item) =>
        item.data.some((network) => network.id === event.rowKey),
      );
      if (section?.unavailable) return;
      const network =
        section?.data.find((item) => item.id === event.rowKey) ??
        (allNetworkItem?.id === event.rowKey ? allNetworkItem : undefined);
      if (!network) return;
      if (event.actionKey === 'network.edit' && network.isCustomNetwork) {
        closeTooltip();
        onEditCustomNetwork?.(network);
      } else if (event.actionKey === 'press') {
        onPressItem?.(network);
      }
    },
    [
      allNetworkItem,
      closeTooltip,
      onEditCustomNetwork,
      onPressItem,
      sections,
      showTooltip,
    ],
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      closeTooltip();
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      setSearchText(text);
    },
    [closeTooltip, setSearchText],
  );

  return (
    <Stack flex={1} position="relative">
      <Stack px="$5" pb="$4">
        <SearchBar
          testID={ChainSelectorTestIDs.searchBar}
          placeholder={intl.formatMessage({ id: ETranslations.global_search })}
          value={searchText}
          onChangeText={handleSearchChange}
          {...(!platformEnv.isNative && { autoFocus: true })}
        />
      </Stack>
      {recentNetworksEnabled ? (
        <RecentNetworks
          onPressItem={onPressItem}
          availableNetworks={availableNetworks}
          showAllNetwork={showAllNetworkInRecentNetworks}
          swrKeyScope={EAppSWRCacheScopes.editableChainSelector}
          walletId={walletId}
          accountId={accountId}
        />
      ) : null}
      <Stack ref={containerRef} flex={1} position="relative">
        {rows.length ? (
          <NativeList
            ref={listRef}
            testID="network-selector-single-native-list-v2"
            style={LIST_STYLE_V2}
            snapshot={snapshot}
            initialScrollKey={initialScrollKey ?? rows[0].key}
            onRowAction={handleRowAction}
            onActionAnchorInvalidated={onActionAnchorInvalidated}
          />
        ) : null}
        {sections.length === 0 ? (
          <Empty
            illustration="BlockQuestionMark"
            title={intl.formatMessage({ id: ETranslations.global_no_results })}
          />
        ) : null}
        {tooltipElement}
      </Stack>
    </Stack>
  );
}
