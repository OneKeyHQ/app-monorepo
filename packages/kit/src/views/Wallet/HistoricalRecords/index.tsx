import React, { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Divider,
  Empty,
  Icon,
  Modal,
  Pressable,
  ScrollableSectionList,
  ScrollableSectionListProps,
  Typography,
} from '@onekeyhq/components';

import { formatMonth } from '../../../utils/DateUtils';
import TransactionRecord, {
  Transaction,
  getTransactionStatusStr,
} from '../../Components/transactionRecord';
import TransactionDetails from '../../TransactionDetails';
import { ScrollRoute } from '../type';

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

const HistoricalRecords = ({ route }: { route: ScrollRoute }) => {
  const tabPageIndex = route.index;
  const intl = useIntl();
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsInfo, setDetailsInfo] = useState<Transaction>();
  const [transactionRecords, setTransactionRecords] = useState<
    TransactionGroup[]
  >([]);

  useEffect(() => {
    setTransactionRecords(toTransactionSection(TRANSACTION_RECORDS_DATA));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderItem: ScrollableSectionListProps<Transaction>['renderItem'] = ({
    item,
    index,
    section,
  }) => (
    <Pressable.Item
      borderTopRadius={index === 0 ? '12px' : '0px'}
      borderRadius={index === section.data.length - 1 ? '12px' : '0px'}
      onPress={() => {
        setDetailsInfo(item);
        setDetailsVisible(true);
        console.log('Click Transaction : ', item.txId);
      }}
    >
      <TransactionRecord transaction={item} />
    </Pressable.Item>
  );

  const renderSectionHeader: ScrollableSectionListProps<Transaction>['renderSectionHeader'] =
    ({ section: { title, data } }) => (
      <Box pt={3} flexDirection="row">
        <Box
          bg="background-default"
          borderRadius="8px"
          flexDirection="row"
          alignItems="center"
          p={2}
        >
          <Typography.Subheading color="text-subdued">
            {title}
          </Typography.Subheading>
          {data[0] != null && data[0].state === 'pending' && (
            <Box ml={3}>
              <Badge title={data.length.toString()} type="Default" size="sm" />
            </Box>
          )}
        </Box>
      </Box>
    );

  const renderHeader = () => (
    <Box flexDirection="row" justifyContent="space-between" alignItems="center">
      <Typography.Heading>
        {intl.formatMessage({ id: 'transaction__history' })}
      </Typography.Heading>
      <Pressable
        p={1.5}
        onPress={() => {
          console.log('Click Jump block browser');
        }}
      >
        <Icon size={20} name="ExternalLinkSolid" />
      </Pressable>
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

  return (
    <>
      <Box flex={1} pt={4} pr={4} pl={4}>
        <ScrollableSectionList<Transaction>
          index={tabPageIndex}
          sections={transactionRecords}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={() => <Box h="20px" />}
          ItemSeparatorComponent={() => <Divider />}
          keyExtractor={(_, index: number) => index.toString()}
          showsVerticalScrollIndicator={false}
        />
      </Box>
      <Modal
        footer={<Box />}
        header={getTransactionStatusStr(intl, detailsInfo?.state)}
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
      >
        <TransactionDetails txId={detailsInfo?.txId ?? ''} />
      </Modal>
    </>
  );
};

export default HistoricalRecords;
