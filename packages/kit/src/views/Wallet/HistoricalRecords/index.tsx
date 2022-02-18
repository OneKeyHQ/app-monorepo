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
import { Transaction, TxStatus } from '@onekeyhq/engine/src/types/covalent';
import { TransactionDetailRoutesParams } from '@onekeyhq/kit/src/routes';
import { TransactionDetailModalRoutes } from '@onekeyhq/kit/src/routes/Modal/TransactionDetail';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import engine from '../../../engine/EngineProvider';
import { formatMonth } from '../../../utils/DateUtils';
import TransactionRecord from '../../Components/transactionRecord';

type NavigationProp = ModalScreenProps<TransactionDetailRoutesParams>;

type TransactionGroup = { title: string; data: Transaction[] };

export type HistoricalRecordProps = {
  accountId: string | null | undefined;
  networkId: string | null | undefined;
  tokenId?: string | null | undefined;
  isTab?: boolean;
};

const toTransactionSection = (
  queueStr: string,
  _data: Transaction[],
): TransactionGroup[] => {
  const sortData = _data.sort(
    (a, b) =>
      new Date(b.blockSignedAt).getTime() - new Date(a.blockSignedAt).getTime(),
  );

  return sortData.reduce((_pre: TransactionGroup[], _current: Transaction) => {
    let key = queueStr;
    if (_current.successful === TxStatus.Pending) {
      key = queueStr;
    } else {
      key = formatMonth(new Date(_current.blockSignedAt));
    }

    let dateGroup = _pre.find((x) => x.title === key);
    if (!dateGroup) {
      dateGroup = { title: key, data: [] };
      _pre.push(dateGroup);
    }
    dateGroup.data.push(_current);
    return _pre;
  }, []);
};

const defaultProps = {
  tokenId: null,
  isTab: false,
} as const;

const HistoricalRecords: FC<HistoricalRecordProps> = ({
  accountId,
  networkId,
  tokenId,
  isTab,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProp['navigation']>();
  const [transactionRecords, setTransactionRecords] = useState<
    TransactionGroup[]
  >([]);

  const refreshHistory = useCallback(async () => {
    if (accountId && networkId) {
      let history;
      if (tokenId) {
        history = await engine.getErc20TxHistories(
          networkId,
          accountId,
          tokenId,
          0,
          50,
        );
      } else {
        history = await engine.getTxHistories(networkId, accountId, 0, 20);
      }

      if (!history?.error && history?.data?.txList) {
        setTransactionRecords(
          toTransactionSection(
            intl.formatMessage({ id: 'history__queue' }),
            history.data.txList,
          ),
        );
      }
    } else {
      setTransactionRecords([]);
    }
  }, [accountId, intl, networkId, tokenId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

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
        console.log('Click Transaction : ', item.txHash);
      }}
    >
      <TransactionRecord transaction={item} />
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
          console.log('Click Jump block browser');
        }}
        size="sm"
        name="ExternalLinkSolid"
        type="plain"
        circle
      />
    </Box>
  );

  const renderEmpty = () => (
    <Box pb={2} pt={2} flexDirection="row" alignItems="center">
      <Empty
        icon={<Icon name="DatabaseOutline" size={48} />}
        title={intl.formatMessage({ id: 'transaction__history_empty_title' })}
        subTitle={intl.formatMessage({ id: 'transaction__history_empty_desc' })}
        actionTitle={intl.formatMessage({ id: 'action__refresh' })}
        handleAction={() => {
          refreshHistory();
        }}
      />
    </Box>
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
    renderItem,
    renderSectionHeader,
    ListHeaderComponent: renderHeader(),
    ListEmptyComponent: renderEmpty(),
    ListFooterComponent: () => <Box h="20px" />,
    ItemSeparatorComponent: () => <Divider />,
    keyExtractor: (_: Transaction, index: number) => index.toString(),
    showsVerticalScrollIndicator: false,
    stickySectionHeadersEnabled: false,
  });
};

HistoricalRecords.defaultProps = defaultProps;
export default HistoricalRecords;
