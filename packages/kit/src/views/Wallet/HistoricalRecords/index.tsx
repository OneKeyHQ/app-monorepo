import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { SectionListProps } from 'react-native';

import {
  Badge,
  Box,
  Divider,
  Empty,
  Icon,
  IconButton,
  Pressable,
  SectionList,
  Typography,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { Account, SimpleAccount } from '@onekeyhq/engine/src/types/account';
import { Transaction, TxStatus } from '@onekeyhq/engine/src/types/covalent';
import { Network } from '@onekeyhq/engine/src/types/network';
import useOpenBlockBrowser from '@onekeyhq/kit/src/hooks/useOpenBlockBrowser';
import { TransactionDetailRoutesParams } from '@onekeyhq/kit/src/routes';
import { TransactionDetailModalRoutes } from '@onekeyhq/kit/src/routes/Modal/TransactionDetail';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import engine from '../../../engine/EngineProvider';
import TransactionRecord from '../../Components/transactionRecord';

import { useHistoricalRecordsData } from './useHistoricalRecordsData';

type NavigationProp = ModalScreenProps<TransactionDetailRoutesParams>;

export type HistoricalRecordProps = {
  accountId: string | null | undefined;
  networkId: string | null | undefined;
  tokenId?: string | null | undefined;
  headerView?: React.ReactNode | null | undefined;
  isTab?: boolean;
};

const defaultProps = {
  tokenId: null,
  headerView: null,
  isTab: false,
} as const;

const HistoricalRecords: FC<HistoricalRecordProps> = ({
  accountId,
  networkId,
  tokenId,
  headerView,
  isTab,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProp['navigation']>();

  const [account, setAccount] = useState<Account>();
  const [network, setNetwork] = useState<Network>();

  const openBlockBrowser = useOpenBlockBrowser(network);
  const { transactionRecords, isLoading, loadMore, fetchData } =
    useHistoricalRecordsData({ account, network, tokenId });

  const handleScrollToEnd: SectionListProps<unknown>['onEndReached'] =
    useCallback(
      ({ distanceFromEnd }) => {
        if (distanceFromEnd > 0) {
          return;
        }
        loadMore?.();
      },
      [loadMore],
    );

  useEffect(() => {
    async function loadAccount() {
      if (!accountId) return;

      const accounts = await engine.getAccounts([accountId]);
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
      }
    }
    async function loadNetwork() {
      if (!networkId) return;

      const localNetwork = await engine.getNetwork(networkId);
      if (localNetwork) {
        setNetwork(localNetwork);
      }
    }
    loadNetwork();
    loadAccount();
  }, [accountId, networkId]);

  const refreshData = () => {
    fetchData?.();
  };

  const renderItem: SectionListProps<Transaction>['renderItem'] = ({
    item,
    index,
    section,
  }) => (
    <Pressable.Item
      borderTopRadius={index === 0 ? '12px' : '0px'}
      borderRadius={index === section.data.length - 1 ? '12px' : '0px'}
      mb={index === section.data.length - 1 ? 6 : undefined}
      onPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.TransactionDetail,
          params: {
            screen: TransactionDetailModalRoutes.TransactionDetailModal,
            params: {
              txHash: null,
              tx: item,
            },
          },
        });
      }}
    >
      <TransactionRecord transaction={item} network={network} />
    </Pressable.Item>
  );

  const renderSectionHeader: SectionListProps<Transaction>['renderSectionHeader'] =
    ({ section: { title, data } }) => (
      <Box pb={2} flexDirection="row">
        <Box flexDirection="row" alignItems="center">
          <Typography.Subheading color="text-subdued">
            {title}
          </Typography.Subheading>
          {data[0] != null && data[0].successful === TxStatus.Pending && (
            <Box ml={3}>
              <Badge title={data.length.toString()} type="default" size="sm" />
            </Box>
          )}
        </Box>
      </Box>
    );

  const renderHeader = () => (
    <>
      <Box>{!!headerView && headerView}</Box>
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        pb={3}
      >
        <Typography.Heading>
          {intl.formatMessage({ id: 'transaction__history' })}
        </Typography.Heading>
        <IconButton
          onPress={() => {
            openBlockBrowser.openAddressDetails(
              (account as SimpleAccount).address,
            );
          }}
          size="sm"
          name="ExternalLinkSolid"
          type="plain"
          circle
        />
      </Box>
    </>
  );

  const renderEmpty = () => (
    <Box pb={2} pt={2} flexDirection="row" alignItems="center">
      <Empty
        icon={<Icon name="DatabaseOutline" size={48} />}
        title={intl.formatMessage({ id: 'transaction__history_empty_title' })}
        subTitle={intl.formatMessage({ id: 'transaction__history_empty_desc' })}
        actionTitle={intl.formatMessage({ id: 'action__refresh' })}
        handleAction={() => {
          refreshData();
        }}
      />
    </Box>
  );

  const renderLoading = () => (
    <Box pb={2} pt={2} flexDirection="column" alignItems="center" />
  );

  let listElementType: JSX.Element;
  if (isTab) {
    listElementType = <Tabs.SectionList sections={[]} />;
  } else {
    listElementType = <SectionList sections={[]} />;
  }

  return React.cloneElement(listElementType, {
    contentContainerStyle: { paddingHorizontal: 16, marginTop: 24 },
    sections: transactionRecords,
    refreshing: isLoading,
    renderItem,
    renderSectionHeader,
    ListHeaderComponent: renderHeader(),
    ListEmptyComponent: isLoading ? renderLoading() : renderEmpty(),
    ListFooterComponent: () => <Box h="20px" />,
    ItemSeparatorComponent: () => <Divider />,
    keyExtractor: (_: Transaction, index: number) => index.toString(),
    showsVerticalScrollIndicator: false,
    stickySectionHeadersEnabled: false,
    onRefresh: refreshData,
    onEndReached: handleScrollToEnd,
  });
};

HistoricalRecords.defaultProps = defaultProps;
export default HistoricalRecords;
