import type { FC } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { format as dateFormat } from 'date-fns';
import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  Divider,
  Empty,
  IconButton,
  SectionList,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useFormatDate from '../../../hooks/useFormatDate';
import { useWalletsSwapTransactions } from '../hooks/useTransactions';

import { HistoryItem } from './HistoryItem';
import Summary from './Summary';

import type { TransactionDetails } from '../typings';
import type { SectionListData, SectionListRenderItem } from 'react-native';

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
        emoji="🕐"
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
  const transactions = useWalletsSwapTransactions();
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

  return (
    <SectionList
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
    backgroundApiProxy.serviceSwap.clearTransactions();
    setVisible(false);
  }, []);
  return (
    <Box px="4">
      <IconButton type="plain" name="TrashOutline" onPress={onPress} />
      <Dialog
        visible={visible}
        contentProps={{
          iconName: 'TrashMini',
          iconType: 'danger',
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

const HistoryLayout: FC = ({ children }) => {
  const navigation = useNavigation();
  const intl = useIntl();
  const isSmall = useIsVerticalLayout();
  const onBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  useLayoutEffect(() => {
    if (!isSmall) {
      navigation.setOptions({ headerShown: false });
    } else {
      navigation.setOptions({
        // eslint-disable-next-line react/no-unstable-nested-components
        headerRight: () => <TrashButton />,
      });
    }
  }, [navigation, isSmall]);
  if (isSmall) {
    return (
      <Box
        bg="background-default"
        w="full"
        h="full"
        style={{ maxWidth: 768, marginHorizontal: 'auto' }}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box bg="background-default" w="full" h="full" px="8">
      <Box w="full" flexDirection="row" alignItems="center" py="5">
        <IconButton onPress={onBack} type="plain" name="ArrowLeftOutline" />
      </Box>
      <Box
        display="flex"
        justifyContent="space-between"
        flexDirection="row"
        mb="8"
      >
        <Typography.DisplayLarge px="4">
          {intl.formatMessage({ id: 'title__swap_history' })}
        </Typography.DisplayLarge>
        <TrashButton />
      </Box>
      {children}
    </Box>
  );
};

const History = () => (
  <HistoryLayout>
    <HistorySectionList />
  </HistoryLayout>
);

export default History;
