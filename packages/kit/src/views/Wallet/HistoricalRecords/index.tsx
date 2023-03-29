import type { FC, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

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
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Transaction } from '@onekeyhq/engine/src/types/covalent';
import { TxStatus } from '@onekeyhq/engine/src/types/covalent';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useOpenBlockBrowser from '@onekeyhq/kit/src/hooks/useOpenBlockBrowser';
import type { TransactionDetailRoutesParams } from '@onekeyhq/kit/src/routes';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TransactionDetailModalRoutes } from '../../../routes/routesEnum';

import { useHistoricalRecordsData } from './useHistoricalRecordsData';

import type { SectionListProps } from 'react-native';

type NavigationProp = ModalScreenProps<TransactionDetailRoutesParams>;

export type HistoricalRecordProps = {
  accountId?: string | null;
  networkId?: string | null;
  tokenId?: string | null | undefined;
  historyFilter?: (item: any) => boolean;
  headerView?: ReactNode | null;
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

const divider = () => <Divider key="separator" />;
const footer = () => <Box key="footer" h="20px" />;
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
  const responsivePadding = ['NORMAL', 'LARGE'].includes(size) ? 32 : 16;

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
      <Box />
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
          name="ArrowPathMini"
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
            name="ArrowTopRightOnSquareMini"
            type="plain"
            circle
          />
        )}
      </Box>
    </Box>
  );

  const renderListHeader = hiddenHeader ? null : (
    <>
      {headerView}
      {headerViewBar}
    </>
  );

  const renderEmpty = () => (
    <Box py={4} flexDirection="column" alignItems="center">
      <Empty
        emoji="🕐"
        title={intl.formatMessage({ id: 'transaction__history_empty_title' })}
        subTitle={intl.formatMessage({
          id: 'transaction__history_empty_desc',
        })}
        actionTitle={intl.formatMessage({ id: 'action__refresh' })}
        handleAction={refresh}
      />
      {!!platformEnv.isDev && (
        <IconButton
          onPress={() => {
            openAddressDetails(account?.address);
          }}
          p={2}
          size="sm"
          name="ArrowTopRightOnSquareMini"
          type="plain"
          circle
        />
      )}
    </Box>
  );

  const renderLoading = () => (
    <Center pb={8} pt={8}>
      <Spinner size="lg" />
    </Center>
  );

  const ListElementType = isTab ? Tabs.SectionList : SectionList;

  return (
    <ListElementType
      bg="background-default"
      contentContainerStyle={{
        paddingHorizontal: responsivePadding,
        marginTop: 24,
      }}
      // @ts-expect-error
      sections={transactionRecords}
      // @ts-ignore
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListHeaderComponent={renderListHeader}
      ListEmptyComponent={isLoading ? renderLoading : renderEmpty}
      ListFooterComponent={footer}
      ItemSeparatorComponent={divider}
      keyExtractor={(tx: Transaction) => tx.txHash}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
    />
  );
};

HistoricalRecords.defaultProps = defaultProps;
export default HistoricalRecords;
