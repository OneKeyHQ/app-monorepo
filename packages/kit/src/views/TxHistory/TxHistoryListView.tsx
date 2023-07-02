/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import useSWR from 'swr';

import {
  Badge,
  Box,
  Divider,
  SectionList,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { IHistoryTx } from '@onekeyhq/engine/src/vaults/types';
import { IDecodedTxStatus } from '@onekeyhq/engine/src/vaults/types';
import { HISTORY_CONSTS } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useAccountPortfolios,
  useActiveWalletAccount,
  useAppSelector,
} from '../../hooks';
import useFormatDate from '../../hooks/useFormatDate';
import { useVisibilityFocused } from '../../hooks/useVisibilityFocused';
import { wait } from '../../utils/helper';
import { useIsAtHomeTab } from '../../utils/routeUtils';
import { TxListItemView } from '../TxDetail/TxListItemView';
import { WalletHomeTabEnum } from '../Wallet/type';

import {
  TxHistoryContextProvider,
  useTxHistoryContext,
} from './TxHistoryContext';
import { TxHistoryListViewEmpty } from './TxHistoryListViewEmpty';
import { TxHistoryListViewHeader } from './TxHistoryListViewHeader';

import type { SectionListProps } from 'react-native';

export type IHistoryListSectionGroup = {
  title?: string;
  titleKey?: LocaleIds;
  data: IHistoryTx[];
};

function isHistoryTxChanged({
  oldTxList,
  newTxList,
}: {
  oldTxList: IHistoryTx[];
  newTxList: IHistoryTx[];
}) {
  if (oldTxList.length !== newTxList.length) {
    return true;
  }
  // check latest 5 tx
  for (let i = 0; i < 5; i += 1) {
    const oldTx = oldTxList[i];
    const newTx = newTxList[i];
    if (!newTx && !oldTx) {
      return false;
    }
    if (!newTx || !oldTx) {
      return true;
    }
    if (
      newTx.id !== oldTx.id ||
      newTx.decodedTx.createdAt !== oldTx.decodedTx.createdAt ||
      newTx.decodedTx.updatedAt !== oldTx.decodedTx.updatedAt ||
      newTx.decodedTx.status !== oldTx.decodedTx.status ||
      newTx.decodedTx.totalFeeInNative !== oldTx.decodedTx.totalFeeInNative
    ) {
      return true;
    }
  }
  return false;
}

function convertToSectionGroups(params: {
  formatDate: (date: number) => string;
  items: IHistoryTx[];
}): IHistoryListSectionGroup[] {
  const { items, formatDate } = params;
  let pendingGroup: IHistoryListSectionGroup | undefined = {
    titleKey: 'transaction__pending',
    data: [],
  };
  const dateGroups: IHistoryListSectionGroup[] = [];
  let currentDateGroup: IHistoryListSectionGroup | undefined;
  items.forEach((item) => {
    if (item.decodedTx.status === IDecodedTxStatus.Pending) {
      pendingGroup?.data.push(item);
    } else {
      const dateKey = formatDate(
        item.decodedTx.updatedAt || item.decodedTx.createdAt || 0,
      );
      if (!currentDateGroup || currentDateGroup.title !== dateKey) {
        if (currentDateGroup) {
          dateGroups.push(currentDateGroup);
        }
        currentDateGroup = {
          title: dateKey,
          data: [],
        };
      }
      currentDateGroup.data.push(item);
    }
  });
  if (currentDateGroup) {
    dateGroups.push(currentDateGroup);
  }
  if (!pendingGroup.data.length) {
    pendingGroup = undefined;
  }
  if (pendingGroup) {
    return [pendingGroup, ...dateGroups].filter(Boolean);
  }
  return [...dateGroups].filter(Boolean);
}

function TxHistoryListViewSectionHeader(props: IHistoryListSectionGroup) {
  const { title, titleKey, data } = props;
  const intl = useIntl();
  const titleText = title || intl.formatMessage({ id: titleKey }) || '';
  return (
    <Box key="section-header" py={2} flexDirection="row">
      <Box flexDirection="row" alignItems="center">
        <Typography.Subheading color="text-subdued">
          {titleText}
        </Typography.Subheading>
        {data[0] && data[0].decodedTx.status === IDecodedTxStatus.Pending && (
          <Box ml={3}>
            <Badge title={data.length.toString()} type="default" size="sm" />
          </Box>
        )}
      </Box>
    </Box>
  );
}

function TxHistoryListSectionList(props: {
  data: IHistoryTx[];
  SectionListComponent: typeof SectionList;
  accountId: string;
  networkId: string;
}) {
  const { networkId, data: historyListData, SectionListComponent } = props;
  const { size } = useUserDevice();
  const formatDate = useFormatDate();
  const responsivePadding = useMemo(() => {
    if (['NORMAL', 'LARGE'].includes(size)) return 32;
    return 16;
  }, [size]);

  const sections = useMemo(
    () =>
      convertToSectionGroups({
        items: historyListData,
        formatDate: (date: number) =>
          formatDate.formatDate(new Date(date), {
            hideTheYear: true,
            hideTimeForever: true,
          }),
      }),
    [historyListData, formatDate],
  );
  const isEmpty = !sections || !sections.length;

  // TODO open detail modal cause re-render
  const renderItem: SectionListProps<IHistoryTx>['renderItem'] = useCallback(
    ({ item, index, section }) => (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      <TxListItemView
        historyTx={item}
        isFirst={index === 0}
        // eslint-disable-next-line no-unsafe-optional-chaining
        isLast={index === section?.data?.length - 1}
      />
    ),
    [],
  );
  const renderSectionHeader: SectionListProps<IHistoryTx>['renderSectionHeader'] =
    useCallback(
      ({ section: { title, titleKey, data } }) => (
        <TxHistoryListViewSectionHeader
          title={title}
          titleKey={titleKey}
          data={data}
        />
      ),
      [],
    );

  const divider = useCallback(() => <Divider key="separator" />, []);
  const sectionListProps = {
    renderItem,
    renderSectionHeader,
    contentContainerStyle: {
      paddingHorizontal: responsivePadding,
      marginTop: 16,
    },
    sections,
    ListHeaderComponent: (
      <TxHistoryListViewHeader
        key="header"
        isEmpty={isEmpty}
        networkId={networkId}
      />
    ),
    ListEmptyComponent: <TxHistoryListViewEmpty key="empty" />,
    ListFooterComponent: <Box key="footer" h="20px" />,
    ItemSeparatorComponent: divider,
    keyExtractor: (tx: IHistoryTx, index: number) =>
      tx.id || index.toString(10),
    showsVerticalScrollIndicator: false,
    stickySectionHeadersEnabled: false,
  };

  return <SectionListComponent {...sectionListProps} />;
}
const TxHistoryListSectionsMemo = memo(TxHistoryListSectionList);

export type ITxHistoryListViewProps = {
  accountId: string | null | undefined;
  networkId: string | null | undefined;
  tokenId?: string; // tokenIdOnNetwork
  isHomeTab?: boolean;
  headerView?: JSX.Element | null;
  tabComponent?: boolean;
};
// TODO use Tabs.SectionList and SectionList instead
function TxHistoryListViewComponent({
  accountId,
  networkId,
  tokenId,
  headerView,
  isHomeTab,
  tabComponent,
}: ITxHistoryListViewProps) {
  const [historyListData, setHistoryListData] = useState<IHistoryTx[]>([]);
  const txDetailContext = useTxHistoryContext();

  const { walletId } = useActiveWalletAccount();

  const isAtHomeTabOfHistory = useIsAtHomeTab(WalletHomeTabEnum.History);
  const { serviceHistory } = backgroundApiProxy;
  const refreshHistoryTs = useAppSelector((s) => s.refresher.refreshHistoryTs);

  const isFocused = useVisibilityFocused();

  const { data: allNetworksTokens } = useAccountPortfolios({
    networkId,
    accountId,
    type: 'tokens',
  });

  const fetchOnChainHistory = useCallback(
    async ({
      networkId: nid,
      accountId: aid,
      refresh,
      tokenAddress,
    }: {
      networkId?: string;
      accountId?: string;
      tokenAddress?: string;
      refresh?: boolean;
    }) => {
      if (!aid || !nid) {
        return Promise.resolve([]);
      }
      if (refresh) {
        try {
          // split refresh and getLocal
          await serviceHistory.refreshHistory({
            networkId: nid,
            accountId: aid,
            tokenIdOnNetwork: tokenAddress,
          });
        } catch (err) {
          debugLogger.common.error(err);
        }
        await wait(1000);
      }

      const txList = await serviceHistory.getLocalHistory({
        networkId: nid,
        accountId: aid,
        tokenIdOnNetwork: tokenAddress || '',
        limit: HISTORY_CONSTS.DISPLAY_TX_LIMIT,
      });
      return txList;
    },
    [serviceHistory],
  );

  const fetchAllNetworksHistory = useCallback(
    async ({
      accountId: aid,
      refresh,
      coingeckoId,
    }: {
      accountId?: string;
      coingeckoId?: string;
      refresh?: boolean;
    }) => {
      const result: IHistoryTx[] = [];
      const allNetworksAccontsMap =
        await backgroundApiProxy.serviceAllNetwork.getAllNetworksWalletAccounts(
          {
            walletId,
            accountId: aid,
          },
        );
      const tokens =
        allNetworksTokens.find((t) => t.coingeckoId === coingeckoId)?.tokens ??
        [];
      for (const token of tokens) {
        if (!token) {
          // eslint-disable-next-line no-continue
          continue;
        }
        const {
          networkId: onChainNetworkId,
          address: tokenAddress,
          accountAddress,
        } = token;
        if (!onChainNetworkId || !accountAddress) {
          // eslint-disable-next-line no-continue
          continue;
        }
        const account = allNetworksAccontsMap[onChainNetworkId].find(
          (a) => a.address === accountAddress,
        );

        if (!account) {
          // eslint-disable-next-line no-continue
          continue;
        }
        const txList = await fetchOnChainHistory({
          networkId: onChainNetworkId,
          accountId: account.id,
          tokenAddress,
          refresh,
        });
        result.push(...txList);
      }
      return result;
    },
    [allNetworksTokens, fetchOnChainHistory, walletId],
  );

  const fetchHistoryTx = useCallback(
    async (options: { refresh?: boolean } = {}): Promise<IHistoryTx[]> => {
      const { refresh = true } = options;
      if (!networkId || !accountId) {
        return [];
      }
      if (isAllNetworks(networkId)) {
        return fetchAllNetworksHistory({
          accountId,
          coingeckoId: tokenId,
          refresh,
        });
      }
      return fetchOnChainHistory({
        networkId,
        accountId,
        tokenAddress: tokenId,
        refresh,
      });
    },
    [
      accountId,
      networkId,
      tokenId,
      fetchOnChainHistory,
      fetchAllNetworksHistory,
    ],
  );

  const getLocalHistory = useCallback(
    () => fetchHistoryTx({ refresh: false }),
    [fetchHistoryTx],
  );

  const shouldDoRefresh = useMemo((): boolean => {
    if (!accountId || !networkId) {
      return false;
    }
    if (!isAccountCompatibleWithNetwork(accountId, networkId)) {
      return false;
    }
    if (!isFocused) {
      return false;
    }
    if (isHomeTab) {
      return isAtHomeTabOfHistory;
    }
    return true;
  }, [accountId, isAtHomeTabOfHistory, isFocused, isHomeTab, networkId]);

  // TODO isValidating, refreshHistoryTs cause re-render, please useContext instead
  const swrKey = isHomeTab ? 'fetchHistoryTx-homeTab' : 'fetchHistoryTx';
  const { mutate, isValidating: isLoading } = useSWR(swrKey, fetchHistoryTx, {
    refreshInterval: 30 * 1000,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    isPaused() {
      return !shouldDoRefresh;
    },
    onSuccess(data) {
      if (
        isHistoryTxChanged({
          oldTxList: historyListData || [],
          newTxList: data || [],
        })
      ) {
        setHistoryListData(data);
      }
    },
  });

  const refresh = useCallback(
    () => serviceHistory.refreshHistoryUi(),
    [serviceHistory],
  );
  // const refresh = mutate;

  useEffect(() => {
    txDetailContext?.setContext((value) => {
      if (
        value.isLoading !== isLoading ||
        value.refresh !== refresh ||
        value.headerView !== headerView
      ) {
        return {
          ...value,
          refresh,
          isLoading,
          headerView,
        };
      }
      return value;
    });
  }, [refresh, isLoading, txDetailContext, headerView]);

  const isTxMatchedToAccount = useMemo(() => {
    const firstHistoryTx: IHistoryTx | undefined = historyListData[0];
    return (
      firstHistoryTx &&
      firstHistoryTx?.decodedTx.networkId === networkId &&
      firstHistoryTx?.decodedTx.accountId === accountId
    );
  }, [accountId, historyListData, networkId]);

  useEffect(() => {
    (async () => {
      if (shouldDoRefresh && !isTxMatchedToAccount) {
        const result = await getLocalHistory();
        setHistoryListData(result || []);
      }
    })();
  }, [
    accountId,
    networkId,
    getLocalHistory,
    shouldDoRefresh,
    isTxMatchedToAccount,
  ]);

  useEffect(() => {
    if (shouldDoRefresh) {
      mutate();
    }
  }, [refreshHistoryTs, accountId, networkId, mutate, shouldDoRefresh]);

  if (!accountId || !networkId) {
    return null;
  }
  const SectionListComponent =
    isHomeTab || tabComponent ? Tabs.SectionList : SectionList;

  return (
    <TxHistoryListSectionsMemo
      accountId={accountId}
      networkId={networkId}
      data={historyListData.sort((a, b) => {
        const ta = a.decodedTx.updatedAt || a.decodedTx.createdAt || 0;
        const tb = b.decodedTx.updatedAt || b.decodedTx.createdAt || 0;
        return tb - ta;
      })}
      SectionListComponent={SectionListComponent}
    />
  );
}

function TxHistoryListView(props: ITxHistoryListViewProps) {
  const { headerView, isHomeTab } = props;
  return (
    <TxHistoryContextProvider headerView={headerView} isTab={isHomeTab}>
      <TxHistoryListViewComponent {...props} />
    </TxHistoryContextProvider>
  );
}

export { TxHistoryListView };
