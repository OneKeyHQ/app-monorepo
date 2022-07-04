import React, {
  FC,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { format as dateFormat } from 'date-fns';
import { useIntl } from 'react-intl';
import {
  ImageSourcePropType,
  SectionListData,
  SectionListRenderItem,
} from 'react-native';

import {
  Box,
  Button,
  Divider,
  Empty,
  Image,
  Pressable,
  SectionList,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/engine/src/types/token';
import historyPNG from '@onekeyhq/kit/assets/3d_transaction_history.png';
import boxPNG from '@onekeyhq/kit/assets/box.png';

import { setHaptics } from '../../../hooks';
import { useActiveWalletAccount, useRuntime } from '../../../hooks/redux';
import useFormatDate from '../../../hooks/useFormatDate';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import PendingTransaction from '../components/PendingTransaction';
import TokenPair from '../components/TokenPair';
import TransactionStatus from '../components/TransactionStatus';
import { useTransactions } from '../hooks/useTransactions';
import { SwapRoutes, TransactionDetails } from '../typings';
import { formatAmount, isNetworkEnabled } from '../utils';

type ContextValues = {
  selectedNetwordId?: string;
  setSelectNetworkId: (value?: string) => void;
};

const NetworkSelectorContext = createContext<ContextValues>({
  selectedNetwordId: undefined,
  setSelectNetworkId: () => {},
});

type ChainSelectorItemProps = {
  label: string;
  imageSource: ImageSourcePropType;
  value?: string;
};

const ChainSelectorItem: FC<ChainSelectorItemProps> = ({
  label,
  imageSource,
  value,
}) => {
  const { selectedNetwordId, setSelectNetworkId } = useContext(
    NetworkSelectorContext,
  );
  const onPress = useCallback(() => {
    setSelectNetworkId(value);
    setHaptics();
  }, [setSelectNetworkId, value]);
  return (
    <Pressable
      py="1"
      pl="1"
      pr="3"
      flexDirection="row"
      bg={
        value === selectedNetwordId
          ? 'surface-neutral-hovered'
          : 'surface-neutral-subdued'
      }
      mr="3"
      mb="3"
      borderRadius="full"
      onPress={onPress}
    >
      <Image w="5" h="5" mr="1" borderRadius="full" source={imageSource} />
      <Typography.Body2Strong>{label}</Typography.Body2Strong>
    </Pressable>
  );
};

type ChainSelectorProps = {
  items: ChainSelectorItemProps[];
};

const ChainSelector: FC<ChainSelectorProps> = ({ items }) => {
  const intl = useIntl();
  return (
    <Box flexDirection="row" flexWrap="wrap" mx="4" mt="4">
      <ChainSelectorItem
        key="all"
        label={intl.formatMessage({ id: 'option__all' })}
        value={undefined}
        imageSource={boxPNG}
      />
      {items.map((item) => (
        <ChainSelectorItem key={item.value} {...item} />
      ))}
    </Box>
  );
};

const ListHeaderComponent = () => {
  const { networks } = useRuntime();
  const { networkId } = useActiveWalletAccount();
  const items = useMemo(() => {
    const chains = networks.filter((network) =>
      isNetworkEnabled(network, [networkId]),
    );
    return chains.map((item) => ({
      label: item.shortName,
      imageSource: { uri: item.logoURI },
      value: item.id,
    }));
  }, [networks, networkId]);
  return <ChainSelector items={items} />;
};

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

type HistoryItemProps = {
  isFirst?: boolean;
  isLast?: boolean;
  isPending?: boolean;
  tx: TransactionDetails;
};

const HistoryItem: FC<HistoryItemProps> = ({
  isFirst,
  isLast,
  isPending,
  tx,
}) => {
  const intl = useIntl();
  const { themeVariant } = useTheme();
  const navigation = useNavigation();
  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Transaction,
        params: {
          accountId: tx.accountId,
          networkId: tx.networkId,
          txid: tx.hash,
        },
      },
    });
  }, [navigation, tx.accountId, tx.networkId, tx.hash]);
  const formatTokenAmount = useCallback(
    ({ token, amount }: { token?: Token; amount?: string }) => {
      if (!token || !amount) return '-';
      return `${formatAmount(amount)} ${token.symbol.toUpperCase()}`;
    },
    [],
  );
  return (
    <Box px="4">
      <Pressable
        bg="surface-default"
        p="4"
        flexDirection="row"
        onPress={onPress}
        borderTopRadius={isFirst ? '12' : undefined}
        borderBottomRadius={isLast ? '12' : undefined}
        borderLeftWidth={0.5}
        borderRightWidth={0.5}
        borderTopWidth={isFirst ? '0.5' : undefined}
        borderBottomWidth={isLast ? '0.5' : undefined}
        borderColor={
          themeVariant === 'light' ? 'border-subdued' : 'transparent'
        }
      >
        <Box mr="4" w="9" h="9" mt="1">
          {tx.tokens ? (
            <TokenPair from={tx.tokens.from.token} to={tx.tokens.to.token} />
          ) : null}
        </Box>
        <Box flex="1">
          <Box>
            <Box flexDirection="row" justifyContent="space-between">
              <Typography.Body1Strong>
                {tx.tokens
                  ? `${tx.tokens.from.token.symbol} → ${tx.tokens.to.token.symbol}`
                  : intl.formatMessage({ id: 'title__swap' })}
              </Typography.Body1Strong>
              <Typography.Body1Strong color="text-success">{`+ ${formatTokenAmount(
                {
                  token: tx.tokens?.to.token,
                  amount: tx.tokens?.to.amount,
                },
              )}`}</Typography.Body1Strong>
            </Box>
            <Box flexDirection="row" justifyContent="space-between">
              <TransactionStatus tx={tx} />
              <Typography.Body1Strong color="text-subdued">{`- ${formatTokenAmount(
                {
                  token: tx.tokens?.from.token,
                  amount: tx.tokens?.from.amount,
                },
              )}`}</Typography.Body1Strong>
            </Box>
          </Box>
          {isPending ? (
            <Box
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              mt="4"
            >
              <Box>
                <Typography.Caption color="text-subdued">
                  {intl.formatMessage({ id: 'transaction__not_confirmed' })}
                </Typography.Caption>
              </Box>
              <Box flexDirection="row">
                <Button size="xs" mr="2">
                  {intl.formatMessage({ id: 'action__cancel' })}
                </Button>
                <Button size="xs" type="primary">
                  {intl.formatMessage({ id: 'action__speed_up' })}
                </Button>
              </Box>
            </Box>
          ) : null}
        </Box>
      </Pressable>
      {tx.status === 'pending' ? <PendingTransaction tx={tx} /> : null}
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
  const { selectedNetwordId } = useContext(NetworkSelectorContext);
  const transactions = useTransactions(accountId, selectedNetwordId);
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
    () => ({ maxWidth: 768, marginHorizontal: 'auto' }),
    [],
  );

  return (
    <SectionList
      contentContainerStyle={contentContainerStyle}
      sections={sections}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparatorComponent}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

const History = () => {
  const { networkId } = useActiveWalletAccount();
  const [selectedNetwordId, setSelectNetworkId] = useState<string | undefined>(
    networkId,
  );
  return (
    <Box bg="background-default" w="full" h="full">
      <NetworkSelectorContext.Provider
        value={{ selectedNetwordId, setSelectNetworkId }}
      >
        <HistorySectionList />
      </NetworkSelectorContext.Provider>
    </Box>
  );
};

export default History;
