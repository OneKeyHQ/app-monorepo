import React, { FC, useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { SectionListProps } from 'react-native';

import {
  Badge,
  Box,
  Center,
  Divider,
  Empty,
  IconButton,
  Pressable,
  SectionList,
  Spinner,
  Typography,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { Transaction, TxStatus } from '@onekeyhq/engine/src/types/covalent';
import IconHistory from '@onekeyhq/kit/assets/3d_transaction_history.png';
import useOpenBlockBrowser from '@onekeyhq/kit/src/hooks/useOpenBlockBrowser';
import { TransactionDetailRoutesParams } from '@onekeyhq/kit/src/routes';
import { TransactionDetailModalRoutes } from '@onekeyhq/kit/src/routes/Modal/TransactionDetail';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import { useActiveWalletAccount } from '../../../hooks/redux';
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
  tokenId,
  headerView,
  isTab,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProp['navigation']>();
  const { network, account } = useActiveWalletAccount();

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

  const refreshData = useCallback(() => {
    fetchData?.();
  }, [fetchData]);

  const renderItem: SectionListProps<Transaction>['renderItem'] = ({
    item,
    index,
    section,
  }) => (
    <Pressable.Item
      key={`${item.txHash}-${index}`}
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
      <TransactionRecord transaction={item} network={network ?? undefined} />
    </Pressable.Item>
  );

  const renderSectionHeader: SectionListProps<Transaction>['renderSectionHeader'] =
    ({ section: { title, data } }) => (
      <Box key="section-header" pb={2} flexDirection="row">
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

  const header = useMemo(
    () => (
      // Warning: Each child in a list should have a unique "key" prop.
      <Box key="header">
        <Box>{headerView}</Box>
        {Boolean(transactionRecords.length) && (
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            pb={3}
          >
            <Typography.Heading>
              {intl.formatMessage({ id: 'transaction__history' })}
            </Typography.Heading>
            <Box flexDirection="row">
              <IconButton
                onPress={() => {
                  refreshData();
                }}
                isLoading={isLoading}
                p={2}
                size="sm"
                name="RefreshSolid"
                type="plain"
                circle
              />
              {network?.blockExplorerURL.address ? (
                <IconButton
                  onPress={() => {
                    openBlockBrowser.openAddressDetails(account?.address);
                  }}
                  ml={3}
                  p={2}
                  size="sm"
                  name="ExternalLinkSolid"
                  type="plain"
                  circle
                />
              ) : null}
            </Box>
          </Box>
        )}
      </Box>
    ),
    [
      account?.address,
      headerView,
      intl,
      isLoading,
      openBlockBrowser,
      refreshData,
      network,
      transactionRecords.length,
    ],
  );

  const renderEmpty = () => (
    <Box py={4} flexDirection="row" alignItems="center">
      <Empty
        imageUrl={IconHistory}
        title={intl.formatMessage({ id: 'transaction__history_empty_title' })}
        subTitle={intl.formatMessage({
          id: 'transaction__history_empty_desc',
        })}
        actionTitle={intl.formatMessage({ id: 'action__refresh' })}
        handleAction={refreshData}
      />
    </Box>
  );

  const renderLoading = () => (
    <Center pb={8} pt={8}>
      <Spinner size="lg" />
    </Center>
  );

  let listElementType: JSX.Element;
  if (isTab) {
    listElementType = <Tabs.SectionList sections={[]} />;
  } else {
    listElementType = <SectionList bg="background-default" sections={[]} />;
  }

  return React.cloneElement(listElementType, {
    contentContainerStyle: { paddingHorizontal: 16, marginTop: 24 },
    sections: transactionRecords,
    extraData: { isLoading },
    renderItem,
    renderSectionHeader,
    ListHeaderComponent: header,
    ListEmptyComponent: isLoading ? renderLoading() : renderEmpty(),
    ListFooterComponent: () => <Box key="footer" h="20px" />,
    ItemSeparatorComponent: () => <Divider key="separator" />,
    keyExtractor: (_: Transaction, index: number) => {
      const key = index.toString();
      return key;
    },
    showsVerticalScrollIndicator: false,
    stickySectionHeadersEnabled: false,
    onEndReached: handleScrollToEnd,
  });
};

HistoricalRecords.defaultProps = defaultProps;
export default HistoricalRecords;
