import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { SectionListProps } from 'react-native';
import useSWR from 'swr';

import {
  Badge,
  Box,
  SectionList,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import {
  IDecodedTxStatus,
  IHistoryTx,
} from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { delay } from '../../background/utils';
import { useAppSelector } from '../../hooks';
import useFormatDate from '../../hooks/useFormatDate';
import { TxListItemView } from '../TxDetail/TxListItemView';
import { WalletHomeTabEnum } from '../Wallet/type';

import { TxHistoryListViewEmpty } from './TxHistoryListViewEmpty';
import { TxHistoryListViewHeader } from './TxHistoryListViewHeader';

export type IHistoryListSectionGroup = {
  title?: string;
  titleKey?: LocaleIds;
  data: IHistoryTx[];
};

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
        {data[0] && data[0].status === IDecodedTxStatus.Pending && (
          <Box ml={3}>
            <Badge title={data.length.toString()} type="default" size="sm" />
          </Box>
        )}
      </Box>
    </Box>
  );
}

// TODO use Tabs.SectionList and SectionList instead
function TxHistoryListView({
  accountId,
  networkId,
  tokenId,
  headerView,
  isHomeTab,
}: {
  accountId: string | null | undefined;
  networkId: string | null | undefined;
  tokenId?: string; // tokenIdOnNetwork
  isHomeTab?: boolean;
  headerView?: JSX.Element | null;
}) {
  const { size } = useUserDevice();
  const [historyListData, setHistoryListData] = useState<IHistoryTx[]>([]);
  const responsivePadding = useMemo(() => {
    if (['NORMAL', 'LARGE'].includes(size)) return 32;
    return 16;
  }, [size]);
  const homeTabName = useAppSelector((s) => s.status.homeTabName);
  const { serviceHistory } = backgroundApiProxy;
  const refreshHistoryTs = useAppSelector((s) => s.refresher.refreshHistoryTs);
  const fetchHistoryTx = useCallback(
    async (options: { refresh?: boolean } = {}): Promise<IHistoryTx[]> => {
      const { refresh = true } = options;
      if (!accountId || !networkId) {
        return Promise.resolve([]);
      }
      if (refresh) {
        try {
          // split refresh and getLocal
          await serviceHistory.refreshHistory({
            networkId,
            accountId,
            tokenIdOnNetwork: tokenId,
          });
        } catch (err) {
          console.error(err);
        }
        await delay(1000);
      }

      const result = await serviceHistory.getLocalHistory({
        networkId,
        accountId,
        tokenIdOnNetwork: tokenId,
      });
      return result;
    },
    [accountId, networkId, serviceHistory, tokenId],
  );
  const getLocalHistory = useCallback(
    () => fetchHistoryTx({ refresh: false }),
    [fetchHistoryTx],
  );
  const shouldDoRefresh = useMemo((): boolean => {
    // if (!isFocused) {
    //   return false;
    // }
    if (isHomeTab) {
      return homeTabName === WalletHomeTabEnum.History;
    }
    return true;
  }, [homeTabName, isHomeTab]);
  // TODO isValidating, refreshHistoryTs cause re-render, please useContext instead
  const swrKey = isHomeTab ? 'fetchHistoryTx-homeTab' : 'fetchHistoryTx';
  const { mutate, isValidating: isLoading } = useSWR(swrKey, fetchHistoryTx, {
    // refreshInterval: 30 * 1000,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    isPaused() {
      return !shouldDoRefresh;
    },
    onSuccess(data) {
      if (data?.[0] && data?.[0]?.id !== historyListData?.[0]?.id) {
        console.log('TxHistoryListView update historyListData >>>> ');
        setHistoryListData(data);
      }
    },
  });

  const firstHistoryTx: IHistoryTx | undefined = historyListData[0];
  const isTxMatched =
    firstHistoryTx &&
    firstHistoryTx?.networkId === networkId &&
    firstHistoryTx?.accountId === accountId;
  useEffect(() => {
    (async () => {
      if (shouldDoRefresh && !isTxMatched) {
        const result = await getLocalHistory();
        console.log('TxHistoryListView mutate 1>>>>', result);
        setHistoryListData(result || []);
      }
    })();
  }, [accountId, networkId, getLocalHistory, shouldDoRefresh, isTxMatched]);

  useEffect(() => {
    if (shouldDoRefresh) {
      console.log('TxHistoryListView mutate 2>>>>');
      mutate();
      console.log('TxHistoryListView mutate 3>>>>');
    }
  }, [refreshHistoryTs, accountId, networkId, mutate, shouldDoRefresh]);

  useEffect(
    () => () => {
      console.log('TxHistoryListView unmount');
    },
    [],
  );

  // const refreshHistoryUi1 = useCallback(
  //   () => serviceHistory.refreshHistoryUi(),
  //   [serviceHistory],
  // );
  const refreshHistoryUi = mutate;

  const formatDate = useFormatDate();

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
    [formatDate, historyListData],
  );
  const isEmpty = !sections || !sections.length;

  // TODO open detail modal cause re-render
  const renderItem: SectionListProps<IHistoryTx>['renderItem'] = useCallback(
    ({ item }) => (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      <TxListItemView decodedTx={item.decodedTx} historyTx={item} />
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
  const header = useMemo(
    () => (
      <Box key="header">
        {headerView}
        {isEmpty ? null : (
          <TxHistoryListViewHeader
            refresh={refreshHistoryUi}
            isLoading={isLoading}
          />
        )}
      </Box>
    ),
    [headerView, isEmpty, isLoading, refreshHistoryUi],
  );
  const sectionListProps: ComponentProps<typeof SectionList> = {
    renderItem,
    // renderItem: () => <Box/>,
    renderSectionHeader,
    contentContainerStyle: {
      paddingHorizontal: responsivePadding,
      marginTop: 16,
    },
    sections,
    extraData: { isLoading },
    ListHeaderComponent: header,
    ListEmptyComponent: (
      <TxHistoryListViewEmpty
        key="empty"
        refresh={refreshHistoryUi}
        isLoading={isLoading}
      />
    ),
    ListFooterComponent: <Box key="footer" h="20px" />,
    // ItemSeparatorComponent: () => <Divider key="separator" />,
    ItemSeparatorComponent: () => <Box key="separator" h={4} />,
    keyExtractor: (tx: IHistoryTx, index: number) =>
      tx.id || index.toString(10),
    showsVerticalScrollIndicator: false,
    stickySectionHeadersEnabled: false,
  };

  if (!accountId || !networkId) {
    return null;
  }
  const SectionListCmp = (isHomeTab ? Tabs.SectionList : SectionList) as (
    props: ComponentProps<typeof SectionList>,
  ) => any;
  console.log(`TxHistoryListView render: ${String(isHomeTab)}`);
  return <SectionListCmp {...sectionListProps} />;
}

export { TxHistoryListView };
