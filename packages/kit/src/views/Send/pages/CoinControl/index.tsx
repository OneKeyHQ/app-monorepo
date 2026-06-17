import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Divider,
  Icon,
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
import { COIN_CONTROL_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EUtxoSelectionStrategy } from '@onekeyhq/shared/types/send';

import { SendConfirmProviderMirror } from '../../components/SendConfirmProvider/SendConfirmProviderMirror';
import { SendTestIDs } from '../../testIDs';

import CoinControlStrategyPopover from './CoinControlStrategyPopover';
import { EUtxoSortType, UTXOListItem, generateUtxoKey } from './UTXOListItem';

import type { RouteProp } from '@react-navigation/core';

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
        // btc find-address feature: claimed off-gap UTXOs are shown here
        // (labeled) so the user can explicitly opt them into a spend
        includeClaimedAddresses: true,
      });
    },
    [accountId, networkId],
    {
      watchLoading: true,
      initResult: [],
    },
  );

  // Memoize utxoList to prevent dependency issues
  const utxoList: IUtxoInfo[] = useMemo(
    () => (Array.isArray(result) ? result : []),
    [result],
  );

  // claimed (find-address) UTXOs must only be spent through an explicit
  // individual check, keep them out of every select-all style operation
  const nonClaimedUtxoKeys = useMemo(
    () =>
      utxoList
        .filter((utxo) => !utxo.isCustomClaimed)
        .map((utxo) => generateUtxoKey(utxo.txid, utxo.vout)),
    [utxoList],
  );

  // Track if initial selection has been applied
  const hasInitializedRef = useRef(false);

  // State management - stores UTXO keys in "txid:vout" format
  const [selectedUTXOs, setSelectedUTXOs] = useState<Set<string>>(new Set());

  // State for UTXO selection strategy
  const [strategy, setStrategy] = useState<EUtxoSelectionStrategy>(
    EUtxoSelectionStrategy.Default,
  );

  // State for sort type
  const [sortType, setSortType] = useState<EUtxoSortType>(
    EUtxoSortType.NewestFirst,
  );

  // Initialize selected UTXOs and strategy when utxoList is loaded
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
      // Use saved selection and strategy
      setSelectedUTXOs(new Set(selectedUTXOsFromAtom.selectedUtxoKeys));
      setStrategy(selectedUTXOsFromAtom.utxoSelectionStrategy);
    } else {
      // Default: select all non-claimed UTXOs with Default strategy
      setSelectedUTXOs(new Set(nonClaimedUtxoKeys));
      setStrategy(EUtxoSelectionStrategy.Default);
    }
  }, [
    utxoList,
    nonClaimedUtxoKeys,
    selectedUTXOsFromAtom,
    networkId,
    accountId,
  ]);

  // Sorted data based on current sort type
  const sortedData = useMemo(() => {
    const data = [...utxoList];
    switch (sortType) {
      case EUtxoSortType.NewestFirst:
        // Sort by height descending (newest first)
        return data.toSorted((a, b) => b.height - a.height);
      case EUtxoSortType.OldestFirst:
        // Sort by height ascending (oldest first)
        return data.toSorted((a, b) => a.height - b.height);
      case EUtxoSortType.LargestFirst:
        // Sort by amount descending (largest first)
        return data.toSorted((a, b) =>
          new BigNumber(b.value).comparedTo(new BigNumber(a.value)),
        );
      case EUtxoSortType.SmallestFirst:
        // Sort by amount ascending (smallest first)
        return data.toSorted((a, b) =>
          new BigNumber(a.value).comparedTo(new BigNumber(b.value)),
        );
      default:
        return data;
    }
  }, [utxoList, sortType]);

  // Check if all items are selected (select-all only covers non-claimed)
  const isAllSelected = useMemo(
    () =>
      nonClaimedUtxoKeys.length > 0 &&
      nonClaimedUtxoKeys.every((key) => selectedUTXOs.has(key)),
    [selectedUTXOs, nonClaimedUtxoKeys],
  );

  // Check if some (but not all) items are selected
  const isIndeterminate = useMemo(
    () => selectedUTXOs.size > 0 && !isAllSelected,
    [selectedUTXOs.size, isAllSelected],
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

  // Select all / Deselect all (claimed UTXOs are only checked individually)
  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      // Deselect all non-claimed keys, but keep any individually-selected
      // claimed UTXOs intact
      setSelectedUTXOs((prev) => {
        const nonClaimedSet = new Set(nonClaimedUtxoKeys);
        const newSet = new Set<string>();
        prev.forEach((key) => {
          if (!nonClaimedSet.has(key)) {
            newSet.add(key);
          }
        });
        return newSet;
      });
    } else {
      // Select all non-claimed keys, preserving any individually-selected
      // claimed UTXOs so they are not silently dropped
      setSelectedUTXOs((prev) => {
        const nonClaimedSet = new Set(nonClaimedUtxoKeys);
        const newSet = new Set(nonClaimedUtxoKeys);
        prev.forEach((key) => {
          if (!nonClaimedSet.has(key)) {
            newSet.add(key);
          }
        });
        return newSet;
      });
    }
  }, [isAllSelected, nonClaimedUtxoKeys]);

  // Done button handler
  const handleDone = useCallback(() => {
    const claimedSelectedCount = utxoList.filter(
      (utxo) =>
        utxo.isCustomClaimed &&
        selectedUTXOs.has(generateUtxoKey(utxo.txid, utxo.vout)),
    ).length;
    if (claimedSelectedCount > 0) {
      defaultLogger.transaction.findAddress.spendFromClaimed({
        networkId,
        claimedUtxoCount: claimedSelectedCount,
      });
    }

    // Save selected UTXOs and strategy to atom
    updateSelectedUTXOs({
      networkId,
      accountId,
      selectedUtxoKeys: Array.from(selectedUTXOs),
      selectedUtxoTotalValue: totalValueRaw,
      utxoSelectionStrategy: strategy,
      timestamp: Date.now(),
    });

    // Navigate back to SendDataInput page
    navigation.pop();
  }, [
    utxoList,
    selectedUTXOs,
    totalValueRaw,
    strategy,
    networkId,
    accountId,
    updateSelectedUTXOs,
    navigation,
  ]);

  const handleLearnMore = useCallback(() => {
    openUrlExternal(COIN_CONTROL_HELP_LINK);
  }, []);

  // Sort options
  const sortOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_newest_first,
        }),
        value: EUtxoSortType.NewestFirst,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_oldest_first,
        }),
        value: EUtxoSortType.OldestFirst,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_smallest_first,
        }),
        value: EUtxoSortType.SmallestFirst,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_sort_largest_first,
        }),
        value: EUtxoSortType.LargestFirst,
      },
    ],
    [intl],
  );

  const claimedLabel = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.find_address_recovered_section__title,
      }),
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
          intl={intl}
          isClaimed={Boolean(item.isCustomClaimed)}
          claimedLabel={claimedLabel}
        />
      );
    },
    [
      selectedUTXOs,
      handleToggleUTXO,
      network?.decimals,
      network?.symbol,
      intl,
      claimedLabel,
    ],
  );

  // Key extractor for list items
  // Include sortType in key to force re-render when sort changes
  const keyExtractor = useCallback(
    (item: IUtxoInfo, index: number) =>
      `${sortType}-${index}-${item.txid}-${item.vout}`,
    [sortType],
  );

  // Get current sort label
  const currentSortLabel = useMemo(() => {
    const option = sortOptions.find((opt) => opt.value === sortType);
    return option?.label ?? '';
  }, [sortType, sortOptions]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.wallet_coin_control })}
      />
      <Page.Body testID={SendTestIDs.coinControlPage}>
        <YStack flex={1}>
          {/* Strategy Selector */}
          <XStack
            px="$5"
            py="$4"
            ai="center"
            jc="space-between"
            borderBottomWidth="$0"
          >
            <SizableText size="$bodyMd" fontWeight="500" color="$text">
              {intl.formatMessage({
                id: ETranslations.wallet_coin_selection_strategy,
              })}
            </SizableText>
            <CoinControlStrategyPopover
              value={strategy}
              onChange={setStrategy}
              onLearnMore={handleLearnMore}
            />
          </XStack>

          {/* Divider */}
          <Stack px="$5">
            <Divider />
          </Stack>

          {/* Sort Selector */}
          <XStack
            px="$5"
            py="$4"
            ai="center"
            jc="space-between"
            borderBottomWidth="$0"
          >
            <SizableText size="$bodyMd" fontWeight="500" color="$text">
              {intl.formatMessage({ id: ETranslations.wallet_sort_coins })}
            </SizableText>
            <Select
              testID={SendTestIDs.coinControlSortSelect}
              title={intl.formatMessage({ id: ETranslations.market_sort_by })}
              value={sortType}
              onChange={setSortType}
              items={sortOptions}
              renderTrigger={({ onPress }) => (
                <XStack
                  // gap="$0.5"
                  ai="center"
                  onPress={onPress}
                  cursor="pointer"
                  px="$2"
                  py="$1"
                  mx="$-2"
                  my="$-1"
                  borderRadius="$2"
                  hoverStyle={{ bg: '$bgHover' }}
                  pressStyle={{ bg: '$bgActive' }}
                >
                  <SizableText
                    size="$bodyMd"
                    fontWeight="500"
                    color="$textSubdued"
                  >
                    {currentSortLabel}
                  </SizableText>
                  <Icon
                    name="ChevronDownSmallOutline"
                    size="$4"
                    color="$iconSubdued"
                  />
                </XStack>
              )}
            />
          </XStack>

          {/* UTXO List */}
          {isLoading ? (
            <Stack
              flex={1}
              alignItems="center"
              justifyContent="center"
              py="$20"
            >
              <Spinner size="large" />
            </Stack>
          ) : (
            <ListView
              flex={1}
              estimatedItemSize={60}
              data={sortedData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              extraData={sortType}
            />
          )}
        </YStack>
      </Page.Body>
      <Page.Footer>
        <XStack px="$5" py="$5" gap="$3" ai="center" bg="$bgApp">
          {/* Select all checkbox */}
          <Checkbox
            testID={SendTestIDs.coinControlSelectAllCheckbox}
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
          <Button
            testID={SendTestIDs.coinControlDoneButton}
            variant="primary"
            onPress={handleDone}
          >
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
