import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Divider,
  Icon,
  Modal,
  Pressable,
  ToastManager,
  Token as TokenIcon,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import { useAccount, useNetwork } from '../../../hooks';
import useFormatDate from '../../../hooks/useFormatDate';
import TransactionRate from '../components/TransactionRate';
import {
  useAllLimitOrders,
  useCancelLimitOrderCallback,
} from '../hooks/useLimitOrder';
import {
  formatAmount,
  getLimitOrderPercent,
  getTokenAmountValue,
} from '../utils';

import type {
  LimitOrderTransactionDetails,
  SwapRoutes,
  SwapRoutesParams,
} from '../typings';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.LimitOrderDetails>;

type InputOuputProps = {
  limitOrder: LimitOrderTransactionDetails;
};

const InputOuput: FC<InputOuputProps> = ({ limitOrder }: InputOuputProps) => {
  const { network } = useNetwork({ networkId: limitOrder.networkId });
  const tokenInValueString = formatAmount(
    getTokenAmountValue(limitOrder.tokenIn, limitOrder.tokenInValue),
  );
  const tokenOutValueString = formatAmount(
    getTokenAmountValue(limitOrder.tokenOut, limitOrder.tokenOutValue),
  );
  return (
    <Box my="0" px="0">
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box flexDirection="row" alignItems="center">
          <TokenIcon size="8" token={limitOrder.tokenIn} />
          <Box ml="3">
            <Typography.Body1>
              {tokenInValueString}
              {limitOrder.tokenIn?.symbol.toString()}
            </Typography.Body1>
            <Typography.Body2 color="text-subdued">
              {network?.name}
            </Typography.Body2>
          </Box>
        </Box>
      </Box>
      <Box
        h="8"
        w="full"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Box mr="4" width="8" flexDirection="row" justifyContent="center">
          <Icon name="ArrowDownMini" size={16} />
        </Box>
      </Box>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box flexDirection="row" alignItems="center">
          <TokenIcon size="8" token={limitOrder.tokenOut} />
          <Box ml="3">
            <Box flexDirection="row" alignItems="center">
              <Typography.Caption mr="1">~</Typography.Caption>
              <Typography.Body1>
                {tokenOutValueString}
                {limitOrder.tokenOut.symbol.toUpperCase()}
              </Typography.Body1>
            </Box>
            <Typography.Body2 color="text-subdued">
              {network?.name}
            </Typography.Body2>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

type TransactionFieldProps = { label: string } & ComponentProps<typeof Box>;
const TransactionField: FC<TransactionFieldProps> = ({
  label,
  children,
  ...rest
}) => (
  <Box
    position="relative"
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    {...rest}
  >
    <Typography.Body2 color="text-disabled">{label}</Typography.Body2>
    <Box>{children}</Box>
  </Box>
);

function useKeepState(data?: LimitOrderTransactionDetails) {
  const [state, setState] = useState(data);
  useEffect(() => {
    if (data) {
      setState(data);
    }
  }, [data]);
  return state;
}

const LimitOrderDetailsModal = () => {
  const route = useRoute<RouteProps>();
  const intl = useIntl();
  const orders = useAllLimitOrders();
  const { formatDate } = useFormatDate();
  const [loading, setLoading] = useState(false);
  const sendCancelLimitOrder = useCancelLimitOrderCallback();
  const { orderHash } = route.params;
  const item = orders.find((s) => s.orderHash === orderHash);
  const limitOrder = useKeepState(item);

  const { account } = useAccount({
    accountId: limitOrder?.accountId ?? '',
    networkId: limitOrder?.networkId ?? '',
  });

  const onCopy = useCallback(() => {
    if (limitOrder) {
      copyToClipboard(limitOrder.orderHash);
      ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
    }
  }, [limitOrder, intl]);

  const onCancel = useCallback(async () => {
    if (account && limitOrder) {
      setLoading(true);
      try {
        await sendCancelLimitOrder({
          activeAccount: account,
          details: limitOrder,
        });
      } finally {
        setLoading(false);
      }
    }
  }, [sendCancelLimitOrder, limitOrder, account]);

  if (!limitOrder) {
    return null;
  }

  const expr =
    Number(limitOrder.remainingFillable) === 0
      ? intl.formatMessage({ id: 'form_opened' })
      : `${Math.floor(Number(getLimitOrderPercent(limitOrder)))}%`;

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__order_details' })}
      hideSecondaryAction
      primaryActionTranslationId="action__cancel"
      onPrimaryActionPress={onCancel}
      footer={limitOrder.canceled ? null : undefined}
      primaryActionProps={{
        leftIconName: 'XMarkOutline',
        type: 'plain',
        width: 'full',
        isLoading: loading,
      }}
    >
      <Box>
        <InputOuput limitOrder={limitOrder} />
        <Divider my="4" />
        <VStack space="4">
          <TransactionField label={intl.formatMessage({ id: 'Rate' })}>
            <TransactionRate
              tokenA={limitOrder.tokenIn}
              tokenB={limitOrder.tokenOut}
              rate={limitOrder.rate}
            />
          </TransactionField>
          <TransactionField
            label={intl.formatMessage({ id: 'form__order_hash' })}
          >
            <Pressable
              flexDirection="row"
              alignItems="center"
              mr="1"
              onPress={onCopy}
            >
              <Typography.Body2Strong mr="1">
                {shortenAddress(limitOrder.orderHash)}
              </Typography.Body2Strong>
              <Icon size={16} name="Square2StackOutline" />
            </Pressable>
          </TransactionField>
          <TransactionField
            label={intl.formatMessage({ id: 'content__created' })}
          >
            <Typography.Body2Strong>
              {formatDate(new Date(limitOrder.createdAt * 1000))}
            </Typography.Body2Strong>
          </TransactionField>
          <TransactionField
            label={intl.formatMessage({ id: 'form__expiration' })}
          >
            <Typography.Body2Strong>
              {formatDate(new Date(limitOrder.expiredIn * 1000))}
            </Typography.Body2Strong>
          </TransactionField>
          <TransactionField label={intl.formatMessage({ id: 'form__status' })}>
            {limitOrder.canceled ? (
              <Badge
                type="warning"
                size="sm"
                title={intl.formatMessage({ id: 'badge__cancelling' })}
              />
            ) : (
              <Badge type="info" size="sm" title={expr} />
            )}
          </TransactionField>
        </VStack>
      </Box>
    </Modal>
  );
};

export default LimitOrderDetailsModal;
