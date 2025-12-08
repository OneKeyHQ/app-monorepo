import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  HeaderIconButton,
  ListView,
  Page,
  Select,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSelectedUTXOsAtom,
  useSendConfirmActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import type { IUtxoInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { SendConfirmProviderMirror } from '../../components/SendConfirmProvider/SendConfirmProviderMirror';

import type { RouteProp } from '@react-navigation/core';

// Sort type enum
enum ESortType {
  NewestFirst = 'newestFirst',
  OldestFirst = 'oldestFirst',
  SmallestFirst = 'smallestFirst',
  LargestFirst = 'largestFirst',
}

// Format blockTime to readable date
// - If no blockTime and confirmations = 0: show "Pending"
// - Otherwise: show "-"
function formatBlockTime(blockTime?: number, confirmations?: number): string {
  if (blockTime) {
    return formatDate(new Date(blockTime));
  }
  if (confirmations === 0) {
    return appLocale.intl.formatMessage({ id: ETranslations.global_pending });
  }
  return '-';
}

// Generate UTXO unique key
function generateUtxoKey(txid: string, vout: number): string {
  return `${txid}:${vout}`;
}

// ListItem component - optimized with memo for performance
const UTXOListItem = memo(
  ({
    item,
    index,
    isSelected,
    onToggle,
    decimals,
    symbol,
  }: {
    item: IUtxoInfo;
    index: number;
    isSelected: boolean;
    onToggle: (utxoKey: string) => void;
    decimals: number;
    symbol: string;
  }) => {
    const handlePress = useCallback(() => {
      const utxoKey = generateUtxoKey(item.txid, item.vout);
      onToggle(utxoKey);
    }, [item.txid, item.vout, onToggle]);

    const formattedInfo = useMemo(
      () => formatBlockTime(item.blockTime, item.confirmations),
      [item.blockTime, item.confirmations],
    );

    const formattedAmount = useMemo(
      () => new BigNumber(item.value).shiftedBy(-decimals).toFixed(),
      [item.value, decimals],
    );

    const shortenedAddress = useMemo(
      () => accountUtils.shortenAddress({ address: item.address }),
      [item.address],
    );

    return (
      <XStack
        px="$5"
        py="$1"
        gap="$3"
        ai="center"
        onPress={handlePress}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
      >
        {/* Left: Checkbox + Index number */}
        <XStack ai="center" gap="$2" w={80} $md={{ w: 60 }}>
          <Checkbox
            value={isSelected}
            onChange={handlePress}
            shouldStopPropagation
          />
          <SizableText size="$bodyMd" color="$text">
            {index + 1}
          </SizableText>
        </XStack>

        {/* Middle: Amount */}
        <SizableText
          size="$bodyMd"
          color="$text"
          textAlign="right"
          minWidth={120}
        >
          {formattedAmount} {symbol}
        </SizableText>

        {/* Right: Address + Info */}
        <YStack flex={1} ai="flex-end">
          <SizableText size="$bodyMd" color="$text">
            {shortenedAddress}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {formattedInfo}
          </SizableText>
        </YStack>
      </XStack>
    );
  },
);

UTXOListItem.displayName = 'UTXOListItem';

function CoinControlPage() {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.CoinControl>>();
  const { accountId, networkId } = route.params;

  const navigation = useAppNavigation();
  const { updateSelectedUTXOs } = useSendConfirmActions().current;
  const [selectedUTXOsFromAtom] = useSelectedUTXOsAtom();

  const { result: network } = usePromiseResult(async () => {
    if (!networkId) return null;
    return backgroundApiProxy.serviceNetwork.getNetwork({ networkId });
  }, [networkId]);

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (!accountId || !networkId) {
        return [];
      }
      return backgroundApiProxy.serviceAccountProfile.getAccountUtxos({
        accountId,
        networkId,
      });
    },
    [accountId, networkId],
    {
      watchLoading: true,
      initResult: [],
    },
  );

  // Memoize utxoList to prevent dependency issues
  const utxoList: IUtxoInfo[] = useMemo(() => result ?? [], [result]);

  // Track if initial selection has been applied
  const hasInitializedRef = useRef(false);

  // State management - stores UTXO keys in "txid:vout" format
  const [selectedUTXOs, setSelectedUTXOs] = useState<Set<string>>(new Set());

  // Initialize selected UTXOs when utxoList is loaded
  // Priority: 1. Use saved selection from atom if exists 2. Default to select all
  useEffect(() => {
    if (hasInitializedRef.current || utxoList.length === 0) {
      return;
    }
    hasInitializedRef.current = true;

    // Check if there's a saved selection in atom for this account/network
    if (
      selectedUTXOsFromAtom &&
      selectedUTXOsFromAtom.networkId === networkId &&
      selectedUTXOsFromAtom.accountId === accountId &&
      selectedUTXOsFromAtom.selectedUtxoKeys.length > 0
    ) {
      // Use saved selection
      setSelectedUTXOs(new Set(selectedUTXOsFromAtom.selectedUtxoKeys));
    } else {
      // Default: select all UTXOs
      setSelectedUTXOs(
        new Set(utxoList.map((utxo) => generateUtxoKey(utxo.txid, utxo.vout))),
      );
    }
  }, [utxoList, selectedUTXOsFromAtom, networkId, accountId]);
  const [sortType, setSortType] = useState<ESortType>(ESortType.NewestFirst);

  // Sorted data based on current sort type
  const sortedData = useMemo(() => {
    const data = [...utxoList];
    switch (sortType) {
      case ESortType.NewestFirst:
        // Sort by height descending (newest first)
        return data.sort((a, b) => b.height - a.height);
      case ESortType.OldestFirst:
        // Sort by height ascending (oldest first)
        return data.sort((a, b) => a.height - b.height);
      case ESortType.LargestFirst:
        // Sort by amount descending (largest first)
        return data.sort((a, b) =>
          new BigNumber(b.value).comparedTo(new BigNumber(a.value)),
        );
      case ESortType.SmallestFirst:
        // Sort by amount ascending (smallest first)
        return data.sort((a, b) =>
          new BigNumber(a.value).comparedTo(new BigNumber(b.value)),
        );
      default:
        return data;
    }
  }, [utxoList, sortType]);

  // Check if all items are selected
  const isAllSelected = useMemo(
    () => selectedUTXOs.size === utxoList.length && utxoList.length > 0,
    [selectedUTXOs.size, utxoList.length],
  );

  // Check if some (but not all) items are selected
  const isIndeterminate = useMemo(
    () => selectedUTXOs.size > 0 && selectedUTXOs.size < utxoList.length,
    [selectedUTXOs.size, utxoList.length],
  );

  // Checkbox value state
  const checkboxValue: ICheckedState = useMemo(() => {
    if (isAllSelected) return true;
    if (isIndeterminate) return 'indeterminate';
    return false;
  }, [isAllSelected, isIndeterminate]);

  // Calculate total value of selected UTXOs (in smallest unit, e.g. satoshi)
  const totalValueRaw = useMemo(() => {
    let sum = new BigNumber(0);
    sortedData.forEach((utxo) => {
      const utxoKey = generateUtxoKey(utxo.txid, utxo.vout);
      if (selectedUTXOs.has(utxoKey)) {
        sum = sum.plus(utxo.value);
      }
    });
    return sum.toFixed();
  }, [selectedUTXOs, sortedData]);

  // Calculate total amount for display (formatted with decimals)
  const totalAmount = useMemo(() => {
    if (!network) return '0';
    return new BigNumber(totalValueRaw).shiftedBy(-network.decimals).toFixed();
  }, [totalValueRaw, network]);

  // Toggle single UTXO selection
  const handleToggleUTXO = useCallback((utxoKey: string) => {
    setSelectedUTXOs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(utxoKey)) {
        newSet.delete(utxoKey);
      } else {
        newSet.add(utxoKey);
      }
      return newSet;
    });
  }, []);

  // Select all / Deselect all
  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedUTXOs(new Set());
    } else {
      setSelectedUTXOs(
        new Set(utxoList.map((utxo) => generateUtxoKey(utxo.txid, utxo.vout))),
      );
    }
  }, [isAllSelected, utxoList]);

  // Done button handler
  const handleDone = useCallback(() => {
    // Save selected UTXOs to atom
    updateSelectedUTXOs({
      networkId,
      accountId,
      selectedUtxoKeys: Array.from(selectedUTXOs),
      selectedUtxoTotalValue: totalValueRaw,
      timestamp: Date.now(),
    });

    // Navigate back to SendDataInput page
    navigation.pop();
  }, [
    selectedUTXOs,
    totalValueRaw,
    networkId,
    accountId,
    updateSelectedUTXOs,
    navigation,
  ]);

  // Sort options
  const sortOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_newest_first,
        }),
        value: ESortType.NewestFirst,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_oldest_first,
        }),
        value: ESortType.OldestFirst,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_smallest_first,
        }),
        value: ESortType.SmallestFirst,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_largest_first,
        }),
        value: ESortType.LargestFirst,
      },
    ],
    [intl],
  );

  // Render list item
  const renderItem = useCallback(
    ({ item, index }: { item: IUtxoInfo; index: number }) => {
      const utxoKey = generateUtxoKey(item.txid, item.vout);
      return (
        <UTXOListItem
          item={item}
          index={index}
          isSelected={selectedUTXOs.has(utxoKey)}
          onToggle={handleToggleUTXO}
          decimals={network?.decimals ?? 8}
          symbol={network?.symbol ?? 'BTC'}
        />
      );
    },
    [selectedUTXOs, handleToggleUTXO, network?.decimals, network?.symbol],
  );

  // Key extractor for list items
  // Include sortType in key to force re-render when sort changes
  const keyExtractor = useCallback(
    (item: IUtxoInfo, index: number) =>
      `${sortType}-${index}-${item.txid}-${item.vout}`,
    [sortType],
  );

  // Header right filter button
  const headerRight = useCallback(
    () => (
      <Select
        title={intl.formatMessage({ id: ETranslations.market_sort_by })}
        value={sortType}
        onChange={setSortType}
        items={sortOptions}
        renderTrigger={({ onPress }) => (
          <HeaderIconButton icon="SliderVerOutline" onPress={onPress} />
        )}
      />
    ),
    [sortType, setSortType, sortOptions, intl],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.wallet_coin_control })}
        headerRight={headerRight}
      />
      <Page.Body>
        {isLoading ? (
          <Stack flex={1} alignItems="center" justifyContent="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <ListView
            estimatedItemSize={60}
            data={sortedData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            extraData={sortType}
          />
        )}
      </Page.Body>
      <Page.Footer>
        <XStack px="$5" py="$5" gap="$3" ai="center" bg="$bgApp">
          {/* Select all checkbox */}
          <Checkbox
            value={checkboxValue}
            onChange={handleSelectAll}
            shouldStopPropagation
          />

          {/* Selected info */}
          <YStack flex={1} jc="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                { id: ETranslations.wallet_selected_utxo_count },
                { count: selectedUTXOs.size },
              )}
            </SizableText>
            <SizableText size="$bodyMd" fontWeight="600" color="$text">
              {totalAmount} {network?.symbol ?? 'BTC'}
            </SizableText>
          </YStack>

          {/* Done button */}
          <Button variant="primary" onPress={handleDone}>
            {intl.formatMessage({
              id: ETranslations.global_done,
            })}
          </Button>
        </XStack>
      </Page.Footer>
    </Page>
  );
}

const CoinControlPageWithProvider = memo(() => (
  <SendConfirmProviderMirror>
    <CoinControlPage />
  </SendConfirmProviderMirror>
));

CoinControlPageWithProvider.displayName = 'CoinControlPageWithProvider';

export default CoinControlPageWithProvider;
