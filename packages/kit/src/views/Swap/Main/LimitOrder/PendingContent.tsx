import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Divider,
  Empty,
  IconButton,
  Pressable,
  Token as TokenImage,
  Typography,
  VStack,
} from '@onekeyhq/components';

import { useAccount, useAppSelector, useNavigation } from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/types';
import {
  useCancelLimitOrderCallback,
  useLimitOrders,
} from '../../hooks/useLimitOrder';
import { SwapRoutes } from '../../typings';
import {
  formatAmount,
  getLimitOrderPercent,
  getTokenAmountValue,
} from '../../utils';

import type { LimitOrderTransactionDetails } from '../../typings';

function useShowLimitOrderDetails(limitOrder: LimitOrderTransactionDetails) {
  const navigation = useNavigation();
  return useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.LimitOrderDetails,
        params: {
          orderHash: limitOrder.orderHash,
        },
      },
    });
  }, [limitOrder.orderHash, navigation]);
}

const CancelButton: FC<{ details: LimitOrderTransactionDetails }> = ({
  details,
}) => {
  const [loading, setLoading] = useState(false);
  const { account } = useAccount({
    accountId: details.accountId,
    networkId: details.networkId,
  });
  const sendCancelLimitOrder = useCancelLimitOrderCallback();
  const onCancel = useCallback(async () => {
    if (!account) {
      return;
    }
    setLoading(true);
    try {
      await sendCancelLimitOrder({ activeAccount: account, details });
    } finally {
      setLoading(false);
    }
  }, [details, account, sendCancelLimitOrder]);
  return (
    <IconButton
      isLoading={loading}
      name="XMarkMini"
      type="plain"
      isDisabled={details.canceled}
      onPress={onCancel}
    />
  );
};

const SimpleView: FC<{ order: LimitOrderTransactionDetails }> = ({ order }) => {
  const intl = useIntl();
  const showDetails = useShowLimitOrderDetails(order);
  const {
    tokenIn,
    tokenOut,
    tokenInValue,
    tokenOutValue,
    remainingFillable,
    canceled,
  } = order;
  const tokenInValueString = formatAmount(
    getTokenAmountValue(tokenIn, tokenInValue),
  );
  const tokenOutValueString = formatAmount(
    getTokenAmountValue(tokenOut, tokenOutValue),
  );
  const text = `${tokenInValueString} ${tokenIn.symbol.toUpperCase()} → ${tokenOutValueString} ${tokenOut.symbol.toUpperCase()}`;

  const expr =
    Number(remainingFillable) === 0
      ? intl.formatMessage({ id: 'form_opened' })
      : `${Math.floor(Number(getLimitOrderPercent(order)))}%`;

  return (
    <Pressable
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      onPress={showDetails}
    >
      <Box flex={1} flexDirection="row" alignItems="center">
        <Box mr="1">
          <TokenImage size="10" borderRadius="full" token={tokenIn} />
        </Box>
        <Box flex="1">
          <Box>
            <Typography.Body2Strong>{text}</Typography.Body2Strong>
          </Box>
          <Box flexDirection="row">
            {canceled ? (
              <Badge
                type="warning"
                size="sm"
                title={intl.formatMessage({ id: 'badge__cancelling' })}
              />
            ) : (
              <Badge type="info" size="sm" title={expr} />
            )}
          </Box>
        </Box>
      </Box>
      <Box w="9">
        {canceled ? null : (
          <Box>
            <CancelButton details={order} />
          </Box>
        )}
      </Box>
    </Pressable>
  );
};

const SimpleViewList: FC<{ orders?: LimitOrderTransactionDetails[] }> = ({
  orders,
}) => {
  const intl = useIntl();
  if (!orders || orders.length === 0) {
    return (
      <Box py="4">
        <Empty
          emoji="🔖"
          title={intl.formatMessage({ id: 'empty__you_have_no_orders' })}
          subTitle={intl.formatMessage({
            id: 'empty__you_have_no_orders_desc',
          })}
          mb={3}
        />
      </Box>
    );
  }
  return (
    <VStack space="4" py="4">
      {orders.map((order) => (
        <SimpleView key={order.orderHash} order={order} />
      ))}
    </VStack>
  );
};

const FullView: FC<{ order: LimitOrderTransactionDetails }> = ({ order }) => {
  const {
    tokenIn,
    tokenOut,
    tokenInValue,
    tokenOutValue,
    remainingFillable,
    canceled,
  } = order;
  const intl = useIntl();
  const showDetails = useShowLimitOrderDetails(order);
  const tokenInValueString = formatAmount(
    getTokenAmountValue(tokenIn, tokenInValue),
  );
  const tokenOutValueString = formatAmount(
    getTokenAmountValue(tokenOut, tokenOutValue),
  );

  const expr =
    Number(remainingFillable) === 0
      ? intl.formatMessage({ id: 'form_opened' })
      : `${Math.floor(Number(getLimitOrderPercent(order)))}%`;

  return (
    <Pressable onPress={showDetails}>
      <Box flexDirection="row">
        <Box w="35%" flexDirection="row" alignItems="center">
          <Box mr="1">
            <TokenImage size="8" borderRadius="full" token={tokenIn} />
          </Box>
          <Box>
            <Typography.Body2Strong>
              {tokenInValueString} {tokenIn.symbol.toUpperCase()}
            </Typography.Body2Strong>
          </Box>
        </Box>
        <Box w="35%" flexDirection="row" alignItems="center">
          <Box mr="1">
            <TokenImage size="8" borderRadius="full" token={tokenOut} />
          </Box>
          <Box>
            <Typography.Body2Strong>
              {tokenOutValueString} {tokenOut.symbol.toUpperCase()}
            </Typography.Body2Strong>
          </Box>
        </Box>
        <Box flex="1" flexDirection="row" alignItems="center">
          {canceled ? (
            <Badge
              type="warning"
              size="sm"
              title={intl.formatMessage({ id: 'badge__cancelling' })}
            />
          ) : (
            <Badge type="info" size="sm" title={expr} />
          )}
        </Box>
        <Box w="10%">
          {canceled ? null : (
            <Box flexDirection="row" alignItems="center">
              <CancelButton details={order} />
            </Box>
          )}
        </Box>
      </Box>
      <Divider color="text-subdued" my="4" />
    </Pressable>
  );
};

const FullViewList: FC<{ orders?: LimitOrderTransactionDetails[] }> = ({
  orders,
}) => {
  const intl = useIntl();
  if (!orders || orders.length === 0) {
    return (
      <Box py="4">
        <Empty
          emoji="🔖"
          title={intl.formatMessage({ id: 'empty__you_have_no_orders' })}
          subTitle={intl.formatMessage({
            id: 'empty__you_have_no_orders_desc',
          })}
          mb={3}
        />
      </Box>
    );
  }
  return (
    <Box py="4">
      <Box flexDirection="row">
        <Box w="35%">
          <Typography.Subheading color="text-subdued">
            {intl.formatMessage({ id: 'action__receive' }).toUpperCase()}
          </Typography.Subheading>
        </Box>
        <Box w="35%">
          <Typography.Subheading color="text-subdued">
            {intl.formatMessage({ id: 'form__pay' }).toUpperCase()}
          </Typography.Subheading>
        </Box>
        <Box flex="1">
          <Typography.Subheading color="text-subdued">
            {intl.formatMessage({ id: 'form__status' }).toUpperCase()}
          </Typography.Subheading>
        </Box>
        <Box w="10%" />
      </Box>
      <Box>
        <VStack space="4" py="4">
          {orders.map((order) => (
            <FullView key={order.orderHash} order={order} />
          ))}
        </VStack>
      </Box>
    </Box>
  );
};

export function PendingSimpleContent() {
  const { activeAccount } = useAppSelector((s) => s.limitOrder);
  const orders = useLimitOrders(activeAccount?.id);
  const intl = useIntl();
  return (
    <Box px="4">
      <Box>
        <Typography.Heading>
          {intl.formatMessage({ id: 'title__open_order' })}
        </Typography.Heading>
      </Box>
      <SimpleViewList orders={orders} />
    </Box>
  );
}

export function PendingFullContent() {
  const intl = useIntl();
  const { activeAccount } = useAppSelector((s) => s.limitOrder);
  const orders = useLimitOrders(activeAccount?.id);
  return (
    <Box px="4" mt="4">
      <Box>
        <Typography.Heading>
          {intl.formatMessage({ id: 'title__open_order' })}
        </Typography.Heading>
      </Box>
      <FullViewList orders={orders} />
    </Box>
  );
}
