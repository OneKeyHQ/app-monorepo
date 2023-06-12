import type { FC } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  Divider,
  Empty,
  FlatList,
  IconButton,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useWalletsSwapTransactions } from '../hooks/useTransactions';

import { HistoryItem } from './HistoryItem';
import Summary from './Summary';

import type { TransactionDetails } from '../typings';
import type { ListRenderItem } from 'react-native';

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

const ListTableHeader = () => {
  const isSmall = useIsVerticalLayout();
  const intl = useIntl();
  return !isSmall ? (
    <Box flexDirection="row" alignItems="center">
      <Box flexBasis="18%">
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({ id: 'action__receive' })}
        </Typography.Subheading>
      </Box>
      <Box flexBasis="18%">
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({ id: 'form__pay' })}
        </Typography.Subheading>
      </Box>
      <Box flexBasis="18%">
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({ id: 'Rate' })}
        </Typography.Subheading>
      </Box>
      <Box flexBasis="18%">
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({ id: 'content__created' })}
        </Typography.Subheading>
      </Box>
      <Box flexBasis="18%">
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({ id: 'form__provider_uppercase' })}
        </Typography.Subheading>
      </Box>
      <Box flexBasis="10%">
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({ id: 'form__status' })}
        </Typography.Subheading>
      </Box>
    </Box>
  ) : null;
};

const ListHeaderComponent = () => (
  <Box>
    <Summary />
    <ListTableHeader />
  </Box>
);

const HistorySectionList = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const transactions = useWalletsSwapTransactions();
  const items = useMemo(() => transactions, [transactions]);
  useEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({ id: 'transaction__history' }),
    });
  }, [navigation, intl]);

  const renderItem: ListRenderItem<TransactionDetails> = useCallback(
    ({ item }) => <HistoryItem tx={item} />,
    [],
  );

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparatorComponent}
      ListFooterComponent={ListFooterComponent}
      ListHeaderComponent={ListHeaderComponent}
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
        mb="4"
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
