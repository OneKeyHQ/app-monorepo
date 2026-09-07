import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Empty, SearchBar, Stack } from '@onekeyhq/components';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { NETWORK_SHOW_VALUE_THRESHOLD_USD } from '@onekeyhq/shared/src/consts/networkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';

import { usePureChainSelectorSections } from '../../hooks/usePureChainSelectorSections';
import { ChainSelectorTestIDs } from '../../testIDs';
import { AllNetworksManagerContext } from '../AllNetworksManager/AllNetworksManagerContext';

import {
  getNetworkTitleMatchV2,
  getNetworkValueV2,
  useNetworkListPresentationV2,
} from './useNetworkListPresentationV2';
import { useNetworkTooltipV2 } from './useNetworkTooltipV2';

import type {
  CheckboxState,
  NativeListRef,
  NativeListSnapshot,
  RowActionEvent,
  RowModel,
  SelectionDeltaEvent,
  TrailingAccessory,
} from '@onekeyfe/react-native-native-list';

const LIST_STYLE_V2 = { flex: 1 };

export default function NetworksSectionListV2() {
  const intl = useIntl();
  const {
    walletId,
    indexedAccountId,
    networks,
    enabledNetworks,
    searchKey,
    setSearchKey,
    accountNetworkValues,
    accountNetworkValueCurrency,
    accountDeFiOverview,
    networksState,
    setNetworksState,
    setMissingAddressCount,
  } = useContext(AllNetworksManagerContext);
  const listRef = useRef<NativeListRef>(null);
  const {
    containerRef,
    showTooltip,
    closeTooltip,
    onActionAnchorInvalidated,
    tooltipElement,
  } = useNetworkTooltipV2(listRef);
  const {
    nativeTheme,
    formatCurrencyValue,
    getNetworkLeading,
    sectionBackground,
  } = useNetworkListPresentationV2(accountNetworkValueCurrency);
  const { sections } = usePureChainSelectorSections({
    networks: networks.mainNetworks,
    searchKey,
    accountNetworkValues,
    accountDeFiOverview,
  });

  const { enabledNetworksWithoutAccount, run } =
    useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
      walletId: walletId ?? '',
      indexedAccountId,
      filterNetworksWithoutAccount: true,
      enabledNetworks,
    });
  useEffect(() => {
    setMissingAddressCount(enabledNetworksWithoutAccount.length);
  }, [enabledNetworksWithoutAccount.length, setMissingAddressCount]);
  const enabledNetworkIds = useMemo(
    () => enabledNetworks.map((network) => network.id).join(','),
    [enabledNetworks],
  );
  useEffect(() => {
    void run();
  }, [enabledNetworkIds, run]);

  const selectedIds = useMemo(
    () =>
      new Set(
        networks.mainNetworks
          .filter((network) =>
            isEnabledNetworksInAllNetworks({
              networkId: network.id,
              isTestnet: network.isTestnet,
              enabledNetworks: networksState.enabledNetworks,
              disabledNetworks: networksState.disabledNetworks,
            }),
          )
          .map((network) => network.id),
      ),
    [networks.mainNetworks, networksState],
  );
  const networkIds = useMemo(
    () => new Set(networks.mainNetworks.map((network) => network.id)),
    [networks.mainNetworks],
  );

  const rows = useMemo<RowModel[]>(() => {
    const result: RowModel[] = [];
    if (!sections.length) return result;
    if (!searchKey.trim()) {
      result.push({
        type: 'sectionHeader',
        presentation: 'networkSelector',
        variant: 'summary',
        key: 'portfolio-summary',
        sectionKey: 'portfolio-summary',
        height: 71,
        title: intl.formatMessage(
          { id: ETranslations.network_view_assets_from_n_networks },
          { count: enabledNetworks.length },
        ),
        titleActionKey: 'network.tooltip.selection',
        titleActionOnHover: true,
        // V1 deliberately treats a partial selection as "deselect all".
        value: intl.formatMessage({
          id: enabledNetworks.length
            ? ETranslations.global_deselect_all
            : ETranslations.global_select_all,
        }),
        valueActionKey: 'network.toggleAll',
        valueActionTestID: ChainSelectorTestIDs.allNetworksToggleAllBtn,
      });
    } else {
      // NetworkListHeader keeps its mt=16/pb=12 wrapper while searching.
      result.push({
        type: 'system',
        variant: 'spacer',
        key: 'portfolio-search-header-spacing',
        height: 28,
        heightRounding: 'nearest',
      });
    }
    sections.forEach((section, index) => {
      const sectionKey = section.totalValue
        ? 'portfolio-assets'
        : `portfolio-section-${section.title ?? 'search'}`;
      if (index) {
        result.push({
          type: 'system',
          variant: 'spacer',
          key: `${sectionKey}-spacer`,
          sectionKey,
          height: 20,
          heightRounding: 'nearest',
        });
      }
      if (section.title) {
        if (section.totalValue) {
          const formattedValue = formatCurrencyValue(section.totalValue);
          const selectedCount = section.data.filter((network) =>
            selectedIds.has(network.id),
          ).length;
          let state: CheckboxState = 'indeterminate';
          if (!selectedCount) state = 'unchecked';
          else if (selectedCount === section.data.length) state = 'checked';
          result.push({
            type: 'sectionHeader',
            presentation: 'networkSelector',
            key: `${sectionKey}-header`,
            sectionKey,
            height: 56,
            backgroundColor: sectionBackground,
            backgroundFullWidth: true,
            title: section.title,
            titleActionKey: 'network.tooltip.assets',
            titleActionOnHover: true,
            value: formattedValue.text,
            valueSegments: formattedValue.textSegments,
            checkbox: {
              kind: 'checkbox',
              state,
              target: { scope: 'section', sectionKey },
            },
          });
        } else {
          result.push({
            type: 'sectionHeader',
            presentation: 'networkSelector',
            key: `${sectionKey}-header`,
            sectionKey,
            title: section.title,
            height: 36,
            indexTitle: section.title.length === 1 ? section.title : undefined,
            heightRounding: 'nearest',
          });
        }
      }
      section.data.forEach((network) => {
        const value = getNetworkValueV2({
          network,
          accountNetworkValues,
          accountDeFiOverview,
        });
        const trailing: TrailingAccessory[] = [];
        if (new BigNumber(value).gt(NETWORK_SHOW_VALUE_THRESHOLD_USD)) {
          trailing.push({ kind: 'value', ...formatCurrencyValue(value) });
        }
        trailing.push({
          kind: 'checkbox',
          state: selectedIds.has(network.id) ? 'checked' : 'unchecked',
          target: { scope: 'row' },
        });
        result.push({
          type: 'identity',
          presentation: 'networkSelector',
          height: 48,
          key: network.id,
          testID: `all-networks-manager-item-${network.id}`,
          sectionKey,
          groupId: network.id,
          groupPosition: 'single',
          size: 'small',
          title: network.name,
          titleMatch: getNetworkTitleMatchV2(network),
          leading: getNetworkLeading(network),
          trailing,
          accessibilityLabel: network.name,
        });
      });
    });
    return result;
  }, [
    accountDeFiOverview,
    accountNetworkValues,
    enabledNetworks.length,
    formatCurrencyValue,
    getNetworkLeading,
    intl,
    searchKey,
    sectionBackground,
    sections,
    selectedIds,
  ]);

  const snapshot = useMemo<NativeListSnapshot>(
    () => ({
      schemaVersion: 1,
      generation: 1,
      theme: {
        ...nativeTheme,
        // Selection is represented by checkboxes in V1, without a row fill.
        rowSelectedBackground: nativeTheme.rowBackground,
      },
      layout: {
        kind: 'sectioned',
        stickyHeaders: false,
        contentPaddingHorizontal: 8,
        contentPaddingTop: 0,
        contentPaddingBottom: 0,
        itemSpacing: 0,
      },
      rows,
      capabilities: { sectionIndex: { enabled: !searchKey.trim() } },
      selection: {
        mode: 'multiple',
        selectedKeys: rows
          .filter((row) => row.type === 'identity' && selectedIds.has(row.key))
          .map((row) => row.key),
        rowPressToggles: true,
      },
    }),
    [nativeTheme, rows, searchKey, selectedIds],
  );

  const handleSelectionDelta = useCallback(
    (event: SelectionDeltaEvent) => {
      setNetworksState((previous) => {
        const next = {
          enabledNetworks: { ...previous.enabledNetworks },
          disabledNetworks: { ...previous.disabledNetworks },
        };
        // Deltas update only affected networks, including when the list is
        // filtered. Replacing the state with visible keys would lose selection.
        event.addedKeys.forEach((key) => {
          if (!networkIds.has(key)) return;
          next.enabledNetworks[key] = true;
          next.disabledNetworks[key] = false;
        });
        event.removedKeys.forEach((key) => {
          if (!networkIds.has(key)) return;
          next.enabledNetworks[key] = false;
          next.disabledNetworks[key] = true;
        });
        return next;
      });
    },
    [networkIds, setNetworksState],
  );

  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      if (event.actionKey === 'network.toggleAll') {
        const allNetworks = Object.fromEntries(
          networks.mainNetworks.map((network) => [network.id, true]),
        );
        setNetworksState(
          enabledNetworks.length
            ? { enabledNetworks: {}, disabledNetworks: allNetworks }
            : { enabledNetworks: allNetworks, disabledNetworks: {} },
        );
      } else if (
        event.actionKey === 'network.tooltip.assets' ||
        event.actionKey === 'network.tooltip.selection'
      ) {
        showTooltip(event);
      }
    },
    [
      enabledNetworks.length,
      networks.mainNetworks,
      setNetworksState,
      showTooltip,
    ],
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      closeTooltip();
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      setSearchKey(text);
    },
    [closeTooltip, setSearchKey],
  );

  return (
    <Stack flex={1}>
      <Stack px="$5">
        <SearchBar
          testID={ChainSelectorTestIDs.allNetworksSearchBar}
          placeholder={intl.formatMessage({ id: ETranslations.global_search })}
          value={searchKey}
          onChangeText={handleSearchChange}
          {...(!platformEnv.isNative && { autoFocus: true })}
        />
      </Stack>
      <Stack ref={containerRef} flex={1} position="relative">
        {sections.length ? (
          <NativeList
            ref={listRef}
            testID="network-selector-portfolio-native-list-v2"
            style={LIST_STYLE_V2}
            snapshot={snapshot}
            onRowAction={handleRowAction}
            onSelectionDelta={handleSelectionDelta}
            onActionAnchorInvalidated={onActionAnchorInvalidated}
          />
        ) : (
          <Empty
            illustration="BlockQuestionMark"
            title={intl.formatMessage({ id: ETranslations.global_no_results })}
          />
        )}
        {tooltipElement}
      </Stack>
    </Stack>
  );
}
