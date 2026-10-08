import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  Icon,
  NumberSizeableText,
  Page,
  SectionList,
  Select,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetDetailRoutes,
  type EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { formatDate, formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IBorrowHistory } from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../Staking/components/PageFrame';
import { capitalizeString } from '../../Staking/utils/utils';
import { getBorrowTxTitle } from '../borrowTxTitle';
import { BorrowTestIDs } from '../testIDs';

import {
  type IBorrowHistoryListItem,
  buildBorrowHistoryListItemKey,
  getBorrowHistoryActionForLocalTx,
} from './borrowHistoryList.utils';

type IHistoryItemProps = {
  item: IEnrichedHistoryItem;
  provider?: string;
};

type IEnrichedHistoryItem = IBorrowHistoryListItem & {
  historyTx?: IAccountHistoryTx;
  token?: IBorrowHistory['tokens'][number];
  network?: IBorrowHistory['networks'][number];
  protocolLogoURI?: string;
};

const HistoryItemSkeleton = () => (
  <ListItem>
    <Skeleton h="$10" w="$10" radius="round" />
    <YStack flex={1} gap="$1">
      <Skeleton h="$4" w={120} borderRadius="$2" />
      <Skeleton h="$3" w={90} borderRadius="$2" />
    </YStack>
    <YStack alignItems="flex-end" gap="$1">
      <Skeleton h="$4" w={80} borderRadius="$2" />
      <Skeleton h="$3" w={60} borderRadius="$2" />
    </YStack>
  </ListItem>
);

const BorrowHistorySkeleton = ({ hideFilter }: { hideFilter: boolean }) => {
  return (
    <YStack>
      {!hideFilter ? (
        <XStack px="$5" pb="$2">
          <XStack h="$12" alignItems="center">
            <Skeleton h="$4" w={140} borderRadius="$2" />
          </XStack>
        </XStack>
      ) : null}
      <Stack pt="$2">
        <HistoryItemSkeleton />
      </Stack>
    </YStack>
  );
};

const HistoryItem = ({ item, provider }: IHistoryItemProps) => {
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowHistoryList
  >();
  const { accountId } = route.params;

  const onPress = useCallback(() => {
    navigation.push(EModalAssetDetailRoutes.HistoryDetails, {
      networkId: item.networkId,
      accountId,
      transactionHash: item.txHash,
      historyTx: item.historyTx,
      isAllNetworks: false,
    });
  }, [accountId, item, navigation]);

  const subtitle = useMemo(() => {
    const time = item.timestamp
      ? formatTime(new Date(item.timestamp), {
          hideSeconds: true,
          hideMilliseconds: true,
        })
      : '';
    if (provider && time) {
      return `${time} · ${capitalizeString(provider)}`;
    }
    if (time) {
      return time;
    }
    return undefined;
  }, [item.timestamp, provider]);

  return (
    <ListItem
      testID={BorrowTestIDs.historyListItem}
      avatarProps={{
        src: item.token?.info.logoURI || item.protocolLogoURI,
        fallbackProps: {
          w: '$10',
          h: '$10',
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="ClockTimeHistoryOutline" />,
        },
        borderRadius: '$full',
        cornerImageProps: item.network?.logoURI
          ? { src: item.network.logoURI }
          : undefined,
      }}
      title={item.title}
      subtitle={subtitle}
      onPress={onPress}
    >
      <YStack>
        {item.amount && item.token?.info.symbol ? (
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="balance"
            color={item.direction === 'receive' ? '$textSuccess' : undefined}
            formatterOptions={{
              tokenSymbol: item.token.info.symbol,
              showPlusMinusSigns: true,
            }}
          >
            {`${item.direction === 'send' ? '-' : ''}${item.amount}`}
          </NumberSizeableText>
        ) : null}
      </YStack>
    </ListItem>
  );
};

type IHistorySectionItem = {
  title: string;
  data: IEnrichedHistoryItem[];
};

type IHistoryContentProps = {
  sections: IHistorySectionItem[];
  filter: Record<string, string>;
  filterType?: string;
  onFilterTypeChange: (type: string) => void;
  hideFilter?: boolean;
  provider?: string;
};

const keyExtractor = (item: IEnrichedHistoryItem) =>
  buildBorrowHistoryListItemKey(item);

const HIDDEN_LOCAL_BORROW_HISTORY_STATUSES = new Set<EDecodedTxStatus>([
  EDecodedTxStatus.Failed,
  EDecodedTxStatus.Dropped,
  EDecodedTxStatus.Removed,
]);

const HistoryContent = ({
  sections,
  filter,
  filterType,
  onFilterTypeChange,
  hideFilter,
  provider,
}: IHistoryContentProps) => {
  const renderItem = useCallback(
    ({ item }: { item: IEnrichedHistoryItem }) => (
      <HistoryItem item={item} provider={provider} />
    ),
    [provider],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: IHistorySectionItem }) => (
      <SectionList.SectionHeader title={section.title} />
    ),
    [],
  );

  const intl = useIntl();

  const items = useMemo(() => {
    // Define the desired order for filter options
    const filterOrder = ['all', 'supply', 'borrow', 'withdraw', 'repay'];
    const keys = Object.keys(filter);

    // Sort keys according to the defined order
    const sortedKeys = keys.toSorted((a, b) => {
      const indexA = filterOrder.indexOf(a.toLowerCase());
      const indexB = filterOrder.indexOf(b.toLowerCase());
      // If key not in order list, put it at the end
      const orderA = indexA === -1 ? filterOrder.length : indexA;
      const orderB = indexB === -1 ? filterOrder.length : indexB;
      return orderA - orderB;
    });

    return sortedKeys.map((key) => ({
      label: filter[key],
      value: key,
    }));
  }, [filter]);

  const handleSelectChange = useCallback(
    (v: string) => {
      onFilterTypeChange(v);
    },
    [onFilterTypeChange],
  );

  return (
    <YStack flex={1}>
      {!hideFilter ? (
        <XStack px="$5">
          <Select
            testID={BorrowTestIDs.historyFilterSelect}
            value={filterType}
            renderTrigger={({ label }) => (
              <XStack h="$12" ai="center" gap="$1">
                <Icon name="Filter2Outline" size="$4" mr="$1" />
                <SizableText size="$bodyMd" color="$textSubdued">
                  {label}
                </SizableText>
                <Icon name="ChevronDownSmallOutline" size="$4" />
              </XStack>
            )}
            items={items}
            onChange={handleSelectChange}
            title={intl.formatMessage({ id: ETranslations.global_filter_by })}
          />
        </XStack>
      ) : null}
      <SectionList
        estimatedItemSize="$14"
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        contentContainerStyle={{
          pb: '$12',
        }}
        ListEmptyComponent={
          <Empty
            pt={40}
            illustration="BookPencil"
            title={intl.formatMessage({
              id: ETranslations.global_no_transactions_yet,
            })}
            description={intl.formatMessage({
              id: ETranslations.global_no_transactions_yet_desc,
            })}
          />
        }
      />
    </YStack>
  );
};

function BorrowHistoryList() {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowHistoryList
  >();
  const intl = useIntl();
  const { accountId, networkId, provider, title, marketAddress, type } =
    route.params;

  const [filterType, setFilterType] = useState(type || 'all');

  const { result, isLoading, run } = usePromiseResult(
    async () => {
      if (!provider || !networkId || !marketAddress) {
        return {
          sections: [],
          filter: {},
        };
      }

      // The remote endpoint contains balance-changing actions only. Read local
      // history in views that can display those actions so metadata-only
      // transactions such as setCollateral are not lost.
      const shouldLoadLocalHistory = filterType === 'all';
      const [historyResp, localHistoryResp] = await Promise.all([
        backgroundApiProxy.serviceStaking.getBorrowHistory({
          accountId,
          networkId,
          provider,
          marketAddress,
          type: filterType,
        }),
        shouldLoadLocalHistory
          ? backgroundApiProxy.serviceHistory
              .fetchAccountHistory({ accountId, networkId })
              .catch((error) => {
                console.warn('Failed to refresh local borrow history', error);
                return undefined;
              })
          : Promise.resolve(undefined),
      ]);

      // Create maps for quick lookup
      const networkMap = new Map(
        historyResp.networks.map((network) => [network.networkId, network]),
      );
      const tokenMap = new Map(
        historyResp.tokens.map((token) => [token.info.address, token]),
      );

      // Enrich list items with token and network data
      const enrichedList = historyResp.list.map((item) => {
        const network = networkMap.get(item.networkId);
        const token = tokenMap.get(item.tokenAddress);

        if (!network || !token) {
          console.warn(
            `Missing network or token for item: networkId=${item.networkId}, tokenAddress=${item.tokenAddress}`,
          );
        }

        return {
          ...item,
          network,
          token,
        };
      });

      const remoteTxHashes = new Set(
        historyResp.list.map((item) => item.txHash.toLowerCase()),
      );
      const localHistoryEntries = (localHistoryResp?.txs ?? [])
        .filter(
          (tx) =>
            !HIDDEN_LOCAL_BORROW_HISTORY_STATUSES.has(tx.decodedTx.status),
        )
        .map((tx: IAccountHistoryTx) => {
          const action = getBorrowHistoryActionForLocalTx({
            tx,
            provider,
            networkId,
            marketAddress,
          });
          const isPending = tx.decodedTx.status === EDecodedTxStatus.Pending;
          if (!action || (filterType !== 'all' && action !== filterType)) {
            return undefined;
          }

          const actionToken = tx.stakingInfo?.send ?? tx.stakingInfo?.receive;
          const token = actionToken
            ? tokenMap.get(actionToken.token.address) ||
              historyResp.tokens.find(
                (item) =>
                  item.info.networkId === actionToken.token.networkId &&
                  item.info.address.toLowerCase() ===
                    actionToken.token.address.toLowerCase(),
              )
            : undefined;
          const txHash = tx.decodedTx.txid;
          if (!txHash || remoteTxHashes.has(txHash.toLowerCase())) {
            return undefined;
          }

          const historyItem: IEnrichedHistoryItem = {
            networkId: tx.decodedTx.networkId,
            txHash,
            title:
              getBorrowTxTitle({ intl, stakingInfo: tx.stakingInfo }) ?? action,
            amount: actionToken?.amount ?? '',
            tokenAddress: actionToken?.token.address ?? '',
            timestamp: tx.decodedTx.updatedAt ?? tx.decodedTx.createdAt ?? 0,
            type: action,
            direction: tx.stakingInfo?.send ? 'send' : 'receive',
            historyTx: tx,
            network: networkMap.get(tx.decodedTx.networkId),
            token,
            protocolLogoURI: tx.stakingInfo?.protocolLogoURI,
          };

          return { item: historyItem, isPending };
        })
        .filter(
          (
            entry,
          ): entry is {
            item: IEnrichedHistoryItem;
            isPending: boolean;
          } => Boolean(entry),
        );

      const pendingLocalItems = localHistoryEntries
        .filter((entry) => entry.isPending)
        .map((entry) => entry.item)
        .toSorted((a, b) => b.timestamp - a.timestamp);
      const localHistoryItems = localHistoryEntries
        .filter((entry) => !entry.isPending)
        .map((entry) => entry.item)
        .toSorted((a, b) => b.timestamp - a.timestamp);
      const listMap = [...enrichedList, ...localHistoryItems]
        .toSorted((a, b) => b.timestamp - a.timestamp)
        .reduce((map, item) => {
          const sectionTitle = formatDate(new Date(item.timestamp), {
            hideTimeForever: true,
          });
          const items = map.get(sectionTitle);
          if (items) {
            items.push(item);
          } else {
            map.set(sectionTitle, [item]);
          }
          return map;
        }, new Map<string, IEnrichedHistoryItem[]>());

      const sections: IHistorySectionItem[] = Array.from(listMap)
        .map(([sectionTitle, data]) => ({
          title: sectionTitle,
          data,
        }))
        .toSorted((a, b) => b.data[0].timestamp - a.data[0].timestamp);

      if (pendingLocalItems.length > 0) {
        sections.unshift({
          title: intl.formatMessage({ id: ETranslations.global_pending }),
          data: pendingLocalItems,
        });
      }

      return {
        sections,
        filter: {
          all: intl.formatMessage({ id: ETranslations.global_all }),
          ...historyResp.filter,
        },
      };
    },
    [accountId, networkId, provider, marketAddress, filterType, intl],
    { watchLoading: true, pollingInterval: 30 * 1000 },
  );

  const skeleton = useCallback(() => {
    return <BorrowHistorySkeleton hideFilter={!!type} />;
  }, [type]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={
          title || intl.formatMessage({ id: ETranslations.global_history })
        }
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={skeleton}
          error={isErrorState({ result, isLoading })}
          loading={isLoadingState({ result, isLoading })}
          onRefresh={run}
        >
          {result ? (
            <HistoryContent
              sections={result.sections}
              filter={result.filter}
              filterType={filterType}
              onFilterTypeChange={setFilterType}
              hideFilter={!!type}
              provider={provider}
            />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
}

export default BorrowHistoryList;
