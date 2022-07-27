import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { format as dateFormat } from 'date-fns';
import { useIntl } from 'react-intl';
import { SectionListData, SectionListRenderItem } from 'react-native';

import {
  Box,
  Center,
  Dialog,
  Divider,
  Empty,
  Icon,
  IconButton,
  SectionList,
  Typography,
} from '@onekeyhq/components';
import historyPNG from '@onekeyhq/kit/assets/3d_transaction_history.png';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks/redux';
import useFormatDate from '../../../hooks/useFormatDate';
import { clearTransactions } from '../../../store/reducers/swapTransactions';
import { useTransactions } from '../hooks/useTransactions';
import { TransactionDetails } from '../typings';

import { HistoryItem } from './HistoryItem';
import Summary from './Summary';

const ItemSeparatorComponent = () => (
  <Box mx="4">
    <Divider />
  </Box>
);
const ListFooterComponent = () => <Box h="4" />;
const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Box py="8">
      <Empty
        title={intl.formatMessage({ id: 'transaction__history_empty_title' })}
        subTitle={intl.formatMessage({ id: 'transaction__history_empty_desc' })}
        imageUrl={historyPNG}
      />
    </Box>
  );
};

type TransactionSection = {
  title: string;
  data: TransactionDetails[];
};

function timestamp(value: number) {
  const date = new Date(value);
  return `${dateFormat(date, 'yyyy-MM-dd')}`;
}

const HistorySectionList = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { format } = useFormatDate();
  const { accountId } = useActiveWalletAccount();
  const transactions = useTransactions(accountId);
  const sections = useMemo(() => {
    const result: Record<string, TransactionDetails[]> = {};
    for (let i = 0; i < transactions.length; i += 1) {
      const tx = transactions[i];
      const title = timestamp(tx.addedTime);
      if (!result[title]) {
        result[title] = [];
      }
      result[title].push(tx);
    }
    return Object.entries(result).map(([title, data]) => ({ title, data }));
  }, [transactions]);
  useEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({ id: 'transaction__history' }),
    });
  }, [navigation, intl]);

  const renderItem: SectionListRenderItem<
    TransactionDetails,
    TransactionSection
  > = useCallback(
    ({ index, section, item }) => (
      <HistoryItem
        isFirst={index === 0}
        isLast={index === section.data.length - 1}
        tx={item}
      />
    ),
    [],
  );

  const renderSectionHeader = useCallback(
    (item: {
      section: SectionListData<TransactionDetails, TransactionSection>;
    }) => (
      <Typography.Subheading p="4" color="text-subdued">
        {format(new Date(item.section.title), 'LLL dd yyyy')}
      </Typography.Subheading>
    ),
    [format],
  );

  const contentContainerStyle = useMemo(
    () => ({ maxWidth: 768, marginHorizontal: 'auto', width: '100%' }),
    [],
  );

  return (
    <SectionList
      contentContainerStyle={contentContainerStyle}
      sections={sections}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparatorComponent}
      ListFooterComponent={ListFooterComponent}
      ListHeaderComponent={Summary}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

const TrashButton = () => {
  const intl = useIntl();
  const [visible, setVisible] = useState(false);
  const onPress = useCallback(() => {
    setVisible(true);
  }, []);
  const onClear = useCallback(() => {
    backgroundApiProxy.dispatch(clearTransactions());
    setVisible(false);
  }, []);
  return (
    <Box px="4">
      <IconButton type="plain" name="TrashOutline" onPress={onPress} />
      <Dialog
        visible={visible}
        contentProps={{
          icon: (
            <Center
              p={3}
              mb={4}
              rounded="full"
              bgColor="surface-critical-default"
            >
              <Icon name="TrashSolid" size={24} color="icon-critical" />
            </Center>
          ),
          title: intl.formatMessage({ id: 'action__clear_swap_history' }),
          content: intl.formatMessage({
            id: 'action__clear_swap_history_desc',
          }),
        }}
        footerButtonProps={{
          primaryActionTranslationId: 'action__clear',
          primaryActionProps: { type: 'destructive' },
          onPrimaryActionPress: onClear,
          onSecondaryActionPress() {
            setVisible(false);
          },
        }}
      />
    </Box>
  );
};

const History = () => {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: TrashButton,
    });
  }, [navigation]);
  return (
    <Box bg="background-default" w="full" h="full">
      <HistorySectionList />
    </Box>
  );
};

export default History;
