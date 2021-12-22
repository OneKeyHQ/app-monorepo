import React, { useState } from 'react';

import {
  Badge,
  Box,
  Divider,
  Empty,
  Icon,
  Modal,
  Pressable,
  SectionList,
  Typography,
} from '@onekeyhq/components';

import { formatMonth } from '../../../utils/DateUtils';
import TransactionRecord, {
  Transaction,
} from '../../Components/transactionRecord';
import TransactionDetails from '../../TransactionDetails';

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
    'amount': 10001,
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
    'amount': 10001,
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
      title: '授权 Onekey Swap',
      url: 'swap.onekey.so',
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
    confirmed: 123,
    approveInfo: {
      title: '授权 Onekey Swap',
      url: 'swap.onekey.so',
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

const HistoricalRecords = () => {
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsInfo, setDetailsInfo] = useState<Transaction>();
  const [transactionRecords, setTransactionRecords] = useState<
    TransactionGroup[]
  >([]);
  type TransactionGroup = { title: string; data: Transaction[] };

  const handleData = (_data: Transaction[]) => {
    const sortData = _data.sort((a, b) => b.date.getTime() - a.date.getTime());
    return sortData.reduce(
      (_pre: TransactionGroup[], _current: Transaction) => {
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
      },
      [],
    );
  };

  const renderItem = ({
    item,
    index,
    section,
  }: {
    item: Transaction;
    index: number;
    section: { data: [] };
  }) => (
    <Pressable
      bg="surface-default"
      borderTopRadius={index === 0 ? '12px' : '0px'}
      borderRadius={index === section.data.length - 1 ? '12px' : '0px'}
      onPress={() => {
        setDetailsInfo(item);
        setDetailsVisible(true);
        console.log('Click Transaction : ', item.txId);
      }}
    >
      <TransactionRecord transaction={item} />
    </Pressable>
  );

  const renderSectionHeader = ({
    section: { title, data },
  }: {
    section: { title: string; data: Transaction[] };
  }) => (
    <Box pb={2} pt={2} flexDirection="row" alignItems="center">
      <Typography.Subheading color="text-subdued">
        {title}
      </Typography.Subheading>
      {data[0] != null && data[0].state === 'pending' && (
        <Box ml={3}>
          <Badge title={data.length.toString()} type="Default" size="sm" />
        </Box>
      )}
    </Box>
  );

  const renderEmpty = () => (
    <Box pb={2} pt={2} flexDirection="row" alignItems="center">
      <Empty
        icon={<Icon name="DatabaseOutline" size={48} />}
        title="No Histories"
        subTitle="Transaction history will show here."
        actionTitle="Reload"
        handleAction={() => {
          setTransactionRecords(handleData(TRANSACTION_RECORDS_DATA));
        }}
      />
    </Box>
  );

  return (
    <Box flex={1} pt={4} pr={4} pl={4}>
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Typography.DisplayXLarge>History</Typography.DisplayXLarge>
        <Pressable
          p={1}
          onPress={() => {
            console.log('Click Jump block browser');
          }}
        >
          <Icon name="ExternalLinkOutline" />
        </Pressable>
      </Box>
      <SectionList
        mt={3}
        mb={3}
        sections={transactionRecords}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <Divider />}
        keyExtractor={(_item: TransactionGroup, index: number) =>
          index.toString()
        }
        showsVerticalScrollIndicator={false}
      />
      <Modal
        footer={<Box />}
        header={detailsInfo?.state}
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
      >
        <TransactionDetails txId={detailsInfo?.txId ?? ''} />
      </Modal>
      ;
    </Box>
  );
};

export default HistoricalRecords;
