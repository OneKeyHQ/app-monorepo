import React, { FC, useEffect, useState } from 'react';

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
  useTheme,
  useUserDevice,
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
  accountId?: string | null;
  networkId?: string | null;
  tokenId?: string | null | undefined;
  historyFilter?: (item: any) => boolean;
  headerView?: React.ReactNode | null;
  hiddenHeader?: boolean;
  isTab?: boolean;
};

const defaultProps = {
  tokenId: null,
  historyFilter: undefined,
  headerView: null,
  hiddenHeader: false,
  isTab: false,
} as const;

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

const HistoricalRecords: FC<HistoricalRecordProps> = ({
  accountId,
  networkId,
  tokenId,
  historyFilter,
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
    historyFilter,
  });

  const { size } = useUserDevice();
  const responsivePadding = () => {
    if (['NORMAL', 'LARGE'].includes(size)) return 32;
    return 16;
  };

  const { themeVariant } = useTheme();

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

  const renderItem: SectionListProps<EVMDecodedItem>['renderItem'] = ({
    item,
    index,
    section,
  }) => (
    <Pressable.Item
      key={`${item.txHash}-${index}`}
      borderTopRadius={index === 0 ? '12px' : '0px'}
      borderRadius={index === section.data.length - 1 ? '12px' : '0px'}
      borderWidth={1}
      borderColor={themeVariant === 'light' ? 'border-subdued' : 'transparent'}
      borderTopWidth={index === 0 ? 1 : 0}
      borderBottomWidth={index === section.data.length - 1 ? 1 : 0}
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

  const headerViewBar = (
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
            refresh();
          }}
          isLoading={isLoading}
          p={2}
          size="sm"
          name="RefreshSolid"
          type="plain"
          circle
        />
        {hasAvailable && (
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
        )}
      </Box>
    </Box>
  );

  const header = hiddenHeader ? null : (
    <>
      {headerView}
      {headerViewBar}
    </>
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
        handleAction={refresh}
      />
    </Box>
  );

  const renderLoading = () => (
    <Center pb={8} pt={8}>
      <Spinner size="lg" />
    </Center>
  );

  const ListElementType = isTab
    ? (Tabs.SectionList as typeof SectionList)
    : SectionList;

  return (
    <ListElementType
      bg="background-default"
      contentContainerStyle={{
        paddingHorizontal: responsivePadding(),
        marginTop: 24,
      }}
      sections={transactionRecords}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListHeaderComponent={header}
      ListEmptyComponent={isLoading ? renderLoading : renderEmpty}
      ListFooterComponent={() => <Box key="footer" h="20px" />}
      ItemSeparatorComponent={() => <Divider key="separator" />}
      keyExtractor={(_: Transaction, index: number) => String(index)}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
    />
  );
};

HistoricalRecords.defaultProps = defaultProps;
export default HistoricalRecords;
