import React, { FC, useEffect, useState } from 'react';

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
import { ModalTypes } from '@onekeyhq/kit/src/routes';
import { TransactionDetailModalRoutes } from '@onekeyhq/kit/src/routes/Modal/TransactionDetail';

import { formatMonth } from '../../../utils/DateUtils';
import TransactionRecord, {
  Transaction,
} from '../../Components/transactionRecord';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ModalTransactionDetailScreenNavigationProp = NativeStackNavigationProp<
  ModalTypes,
  TransactionDetailModalRoutes.TransactionDetailModal
>;

const TRANSACTION_RECORDS_DATA: Transaction[] = [
  {
    type: 'Send',
    state: 'success',
    'chainId': 1,
    'txId': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'amount': 10000,
    'to': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'date': new Date(1637472397 * 1000),
    confirmed: 123,
  },
  {
    type: 'Send',
    state: 'pending',
    'chainId': 1,
    'txId': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'amount': 10001.0000000001,
    'to': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'date': new Date(1640064397 * 1000),
    confirmed: 0,
  },
  {
    type: 'Receive',
    state: 'failed',
    'chainId': 1,
    'txId': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'amount': 10001,
    'to': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'date': new Date(1637472397 * 1000),
    confirmed: 123,
  },
  {
    type: 'Receive',
    state: 'success',
    'chainId': 1,
    'txId': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'amount': 9999910001.000000099991,
    'to': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'date': new Date(1634793997 * 1000),
    confirmed: 123,
  },
  {
    type: 'Approve',
    state: 'success',
    'chainId': 1,
    'txId': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'amount': 10001,
    'to': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'date': new Date(1634793997 * 1000),
    confirmed: 1,
    approveInfo: {
      url: 'swap.onekey.so',
      token: 'USDT',
    },
  },
  {
    type: 'Approve',
    state: 'pending',
    'chainId': 1,
    'txId': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'amount': 10001,
    'to': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'date': new Date(1634793997 * 1000),
    confirmed: 1,
    approveInfo: {
      url: 'swap.onekey.so',
      token: 'WBTC',
    },
  },
  {
    type: 'Send',
    state: 'dropped',
    'chainId': 1,
    'txId': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'amount': 10001,
    'to': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'date': new Date(1634793997 * 1000),
    confirmed: 123,
  },
  {
    type: 'Send',
    state: 'success',
    'chainId': 1,
    'txId': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'amount': 10001,
    'to': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    'date': new Date(1634793997 * 1000),
    confirmed: 123,
  },
];

type TransactionGroup = { title: string; data: Transaction[] };

const toTransactionSection = (_data: Transaction[]): TransactionGroup[] => {
  const sortData = _data.sort((a, b) => b.date.getTime() - a.date.getTime());
  return sortData.reduce((_pre: TransactionGroup[], _current: Transaction) => {
    let key = 'QUEUE';
    if (_current.state === 'pending') {
      key = 'QUEUE';
    } else {
      key = formatMonth(_current.date);
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

export type HistoricalRecordProps = {
  isTab?: boolean;
};

const defaultProps = {
  isTab: false,
} as const;

const HistoricalRecords: FC<HistoricalRecordProps> = ({ isTab }) => {
  const intl = useIntl();
  const navigation =
    useNavigation<ModalTransactionDetailScreenNavigationProp>();
  const [transactionRecords, setTransactionRecords] = useState<
    TransactionGroup[]
  >([]);

  useEffect(() => {
    setTransactionRecords(toTransactionSection(TRANSACTION_RECORDS_DATA));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        navigation.navigate(
          TransactionDetailModalRoutes.TransactionDetailModal,
          {
            screen: TransactionDetailModalRoutes.TransactionDetailModal,
            params: {
              txId: item.txId,
            },
          },
        );
        console.log('Click Transaction : ', item.txId);
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
          {data[0] != null && data[0].state === 'pending' && (
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
        actionTitle={intl.formatMessage({ id: 'action__reset' })}
        handleAction={() => {
          setTransactionRecords(toTransactionSection(TRANSACTION_RECORDS_DATA));
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
