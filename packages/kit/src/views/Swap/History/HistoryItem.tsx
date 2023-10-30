import type { FC } from 'react';
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { format as dateFormat } from 'date-fns';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Center,
  Icon,
  Pressable,
  Token as TokenIcon,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { useNetworkSimple } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import SwappingVia from '../components/SwappingVia';
import TransactionRate from '../components/TransactionRate';
import { SwapRoutes } from '../typings';
import { formatAmount } from '../utils';

import type { TransactionDetails, TransactionStatus } from '../typings';

type HistoryItemStatusProps = { status: TransactionStatus };

const HistoryItemStatus: FC<HistoryItemStatusProps> = ({ status }) => {
  const intl = useIntl();
  return (
    <Box>
      {status === 'pending' ? (
        <Badge
          type="info"
          size="sm"
          color="#599BFF"
          title={intl.formatMessage({ id: 'transaction__pending' })}
        />
      ) : null}
      {status === 'failed' ? (
        <Badge
          type="critical"
          size="sm"
          color="text-critical"
          title={intl.formatMessage({ id: 'transaction__failed' })}
        />
      ) : null}
      {status === 'canceled' ? (
        <Badge
          type="critical"
          size="sm"
          color="text-critical"
          title={intl.formatMessage({ id: 'transaction__failed' })}
        />
      ) : null}
      {status === 'sucesss' ? (
        <Badge
          type="success"
          size="sm"
          color="text-success"
          title={intl.formatMessage({ id: 'transaction__success' })}
        />
      ) : null}
    </Box>
  );
};

export type HistoryItemProps = {
  tx: TransactionDetails;
};

const HistoryItemHorizontalView: FC<HistoryItemProps> = ({ tx }) => {
  const navigation = useNavigation();

  const fromNetworkId = tx.tokens?.from.networkId;
  const toNetworkId = tx.tokens?.to.networkId;
  const fromNetwork = useNetworkSimple(fromNetworkId);
  const toNetwork = useNetworkSimple(toNetworkId);
  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Transaction,
        params: {
          txid: tx.hash,
          goBack: () => navigation.goBack(),
        },
      },
    });
  }, [navigation, tx.hash]);
  const formatTokenAmount = useCallback(
    ({ token, amount }: { token?: Token; amount?: string }) => {
      if (!token || !amount) return '-';
      return `${formatAmount(amount)} ${token.symbol.toUpperCase()}`;
    },
    [],
  );
  return (
    <Box>
      <Pressable
        // bg="surface-default"
        py="4"
        onPress={onPress}
        flexDirection="row"
        alignItems="center"
      >
        <Box flexDirection="row" alignItems="center" flexBasis="18%">
          <Box mr="4">
            <TokenIcon
              token={{ logoURI: tx.tokens?.to.token.logoURI }}
              size="8"
            />
          </Box>
          <Box flex="1">
            <Box flexDirection="row" alignItems="center">
              {!tx.actualReceived ? (
                <Typography.Caption>~</Typography.Caption>
              ) : null}
              <Typography.Body1Strong>
                {formatTokenAmount({
                  token: tx.tokens?.to.token,
                  amount: tx.tokens?.to.amount,
                })}
              </Typography.Body1Strong>
            </Box>
            <Typography.Body2 color="text-subdued">
              {toNetwork?.shortName}
            </Typography.Body2>
          </Box>
        </Box>
        <Box flexDirection="row" alignItems="center" flexBasis="18%">
          <Box flexDirection="row" alignItems="center" flex="1">
            <Box flex="1">
              <Box flexDirection="row" alignItems="center">
                <Box flex="1">
                  <Typography.Body1Strong isTruncated>
                    {formatTokenAmount({
                      token: tx.tokens?.from.token,
                      amount: tx.tokens?.from.amount,
                    })}
                  </Typography.Body1Strong>
                </Box>
              </Box>
              <Typography.Body2 color="text-subdued">
                {fromNetwork?.shortName}
              </Typography.Body2>
            </Box>
          </Box>
        </Box>
        <Box flexBasis="18%">
          <TransactionRate
            tokenA={tx.tokens?.from.token}
            tokenB={tx.tokens?.to.token}
            rate={tx.tokens?.rate}
            hideIcon
          />
        </Box>
        <Box
          flexBasis="18%"
          alignItems="center"
          justifyContent="flex-start"
          flexDirection="row"
          px="1"
        >
          <Typography.Body2 color="text-subdued" ml="3" isTruncated>
            {dateFormat(tx.addedTime, 'yyyy/MM/dd HH:mm:ss')}
          </Typography.Body2>
        </Box>
        <Box
          flexBasis="18%"
          alignItems="center"
          justifyContent="flex-start"
          flexDirection="row"
          px="1"
        >
          <SwappingVia
            providers={tx.providers}
            typography="Body2Strong"
            color="text-default"
          />
        </Box>
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          flexBasis="10%"
        >
          <HistoryItemStatus status={tx.status} />
        </Box>
      </Pressable>
    </Box>
  );
};

const HistoryItemVerticalView: FC<HistoryItemProps> = ({ tx }) => {
  const navigation = useNavigation();
  const fromNetworkId = tx.tokens?.from.networkId;
  const toNetworkId = tx.tokens?.to.networkId;
  const fromNetwork = useNetworkSimple(fromNetworkId);
  const toNetwork = useNetworkSimple(toNetworkId);
  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Transaction,
        params: {
          txid: tx.hash,
          goBack: () => navigation.goBack(),
        },
      },
    });
  }, [navigation, tx.hash]);
  const formatTokenAmount = useCallback(
    ({ token, amount }: { token?: Token; amount?: string }) => {
      if (!token || !amount) return '-';
      return `${formatAmount(amount)} ${token.symbol.toUpperCase()}`;
    },
    [],
  );

  return (
    <Box px="4">
      <Pressable p="4" onPress={onPress}>
        <Box flexDirection="row" width="full">
          <Box mr="4">
            <TokenIcon
              token={{ logoURI: tx.tokens?.from.token.logoURI }}
              size="8"
            />
          </Box>
          <Box flexDirection="row" alignItems="center" flex="1" flexWrap="wrap">
            <Typography.Body1Strong mr="2">
              {formatTokenAmount({
                token: tx.tokens?.from.token,
                amount: tx.tokens?.from.amount,
              })}
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued">
              ({fromNetwork?.shortName})
            </Typography.Body2>
          </Box>
        </Box>
        <Center h="4" w="8" my="1">
          <Icon name="ArrowDownMini" size={16} />
        </Center>
        <Box flexDirection="row" width="full">
          <Box mr="4">
            <TokenIcon
              token={{ logoURI: tx.tokens?.to.token.logoURI }}
              size="8"
            />
          </Box>
          <Box flexDirection="row" alignItems="center" flex="1" flexWrap="wrap">
            {!tx.actualReceived ? (
              <Typography.Caption>~</Typography.Caption>
            ) : null}
            <Typography.Body1Strong mr="2">
              {formatTokenAmount({
                token: tx.tokens?.to.token,
                amount: tx.tokens?.to.amount,
              })}
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued">
              ({toNetwork?.shortName})
            </Typography.Body2>
          </Box>
        </Box>
        <Box
          flexDirection="row"
          width="full"
          justifyContent="space-between"
          mt="3"
        >
          <Box flexDirection="row" alignItems="center" pl="2">
            <SwappingVia
              providers={tx.providers}
              typography="Body2"
              color="text-subdued"
              fontWeight={500}
            />
            <Typography.Body2 color="text-subdued" ml="3" fontWeight={500}>
              {dateFormat(tx.addedTime, 'MM/dd HH:mm')}
            </Typography.Body2>
          </Box>
          <HistoryItemStatus status={tx.status} />
        </Box>
      </Pressable>
    </Box>
  );
};

export const HistoryItem: FC<HistoryItemProps> = (props) => {
  const isSmall = useIsVerticalLayout();
  return isSmall ? (
    <HistoryItemVerticalView {...props} />
  ) : (
    <HistoryItemHorizontalView {...props} />
  );
};
