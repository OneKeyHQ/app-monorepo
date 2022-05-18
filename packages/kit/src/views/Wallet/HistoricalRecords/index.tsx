import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { SectionListProps } from 'react-native';
import { useDeepCompareMemo } from 'use-deep-compare';

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
import { Account } from '@onekeyhq/engine/src/types/account';
import { Transaction, TxStatus } from '@onekeyhq/engine/src/types/covalent';
import { Network } from '@onekeyhq/engine/src/types/network';
import { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import IconHistory from '@onekeyhq/kit/assets/3d_transaction_history.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useOpenBlockBrowser from '@onekeyhq/kit/src/hooks/useOpenBlockBrowser';
import { TransactionDetailRoutesParams } from '@onekeyhq/kit/src/routes';
import { TransactionDetailModalRoutes } from '@onekeyhq/kit/src/routes/Modal/TransactionDetail';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import TxRecordCell from '../../Components/transactionRecord/TxRecordCell';

import { useHistoricalRecordsData } from './useHistoricalRecordsData';

type NavigationProp = ModalScreenProps<TransactionDetailRoutesParams>;

export type HistoricalRecordProps = {
  accountId: string | null | undefined;
  networkId: string | null | undefined;
  tokenId?: string | null | undefined;
  isInternalSwapOnly?: boolean;
  headerView?: React.ReactNode | null | undefined;
  hiddenHeader?: boolean;
  isTab?: boolean;
};

const defaultProps = {
  tokenId: null,
  isInternalSwapOnly: false,
  headerView: null,
  hiddenHeader: false,
  isTab: false,
} as const;

const HistoricalRecords: FC<HistoricalRecordProps> = ({
  accountId,
  networkId,
  tokenId,
  isInternalSwapOnly,
  headerView,
  hiddenHeader,
  isTab,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProp['navigation']>();

  const [account, setAccount] = useState<Account>();
  const [network, setNetwork] = useState<Network>();

  const { openAddressDetails, hasAvailable } = useOpenBlockBrowser(network);
  const { transactionRecords, isLoading, refresh } = useHistoricalRecordsData({
    account,
    network,
    tokenId,
    isInternalSwapOnly,
  });

  const hiddenHeaderMemo = useDeepCompareMemo(
    () => hiddenHeader,
    [hiddenHeader],
  );

  useEffect(() => {
    async function loadAccount() {
      if (!accountId) return;

      const accounts = await backgroundApiProxy.engine.getAccounts([accountId]);
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
      }
    }
    async function loadNetwork() {
      if (!networkId) return;

      const localNetwork = await backgroundApiProxy.engine.getNetwork(
        networkId,
      );
      if (localNetwork) {
        setNetwork(localNetwork);
      }
    }
    loadNetwork();
    loadAccount();
  }, [accountId, networkId]);

  // Switch language, switch account automatically refresh
  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshData = useCallback(() => {
    refresh?.();
  }, [refresh]);

  const renderItem: SectionListProps<EVMDecodedItem>['renderItem'] = ({
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
            screen: TransactionDetailModalRoutes.HistoryDetailModal,
            params: {
              decodedItem: item,
            },
          },
        });
      }}
    >
      <TxRecordCell tx={item} />
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

  const headerViewMemo = useMemo(() => <Box>{headerView}</Box>, [headerView]);

  const headerViewBarMemo = useMemo(
    () =>
      Boolean(transactionRecords.length) && (
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
            {hasAvailable ? (
              <IconButton
                onPress={() => {
                  openAddressDetails(account?.address);
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
      ),
    [
      account?.address,
      hasAvailable,
      intl,
      isLoading,
      openAddressDetails,
      refreshData,
      transactionRecords.length,
    ],
  );

  const header = useMemo(
    () => (
      // Warning: Each child in a list should have a unique "key" prop.
      <Box key="header">
        {headerViewMemo}
        {headerViewBarMemo}
      </Box>
    ),
    [headerViewMemo, headerViewBarMemo],
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
    ListHeaderComponent: hiddenHeaderMemo ? null : header,
    ListEmptyComponent: isLoading ? renderLoading() : renderEmpty(),
    ListFooterComponent: () => <Box key="footer" h="20px" />,
    ItemSeparatorComponent: () => <Divider key="separator" />,
    keyExtractor: (_: Transaction, index: number) => {
      const key = index.toString();
      return key;
    },
    showsVerticalScrollIndicator: false,
    stickySectionHeadersEnabled: false,
  });
};

HistoricalRecords.defaultProps = defaultProps;
export default HistoricalRecords;
