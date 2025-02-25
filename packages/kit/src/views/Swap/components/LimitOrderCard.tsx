import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Divider,
  IconButton,
  NumberSizeableText,
  Progress,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  ESwapLimitOrderStatus,
  type IFetchLimitOrderRes,
} from '@onekeyhq/shared/types/swap/types';

import { Token } from '../../../components/Token';

const LimitOrderCard = ({
  item,
  progressWidth = 255,
  onPress,
  hiddenCancelIcon = false,
  onCancel,
  cancelLoading,
}: {
  item: IFetchLimitOrderRes;
  progressWidth?: number;
  onPress?: () => void;
  hiddenCancelIcon?: boolean;
  onCancel?: () => void;
  cancelLoading?: boolean;
}) => {
  const { fromTokenInfo, toTokenInfo, fromAmount, toAmount } = item;
  const intl = useIntl();
  const { gtMd } = useMedia();
  const createdAtFormat = useMemo(() => {
    const date = new BigNumber(item.createdAt).toNumber();
    const dateStr = formatDate(new Date(date), {
      hideSeconds: true,
    });
    return (
      <XStack justifyContent="space-between">
        <SizableText size="$bodySm" color="$textSubdued">
          {dateStr}
        </SizableText>
      </XStack>
    );
  }, [item.createdAt]);

  const expirationTitle = useMemo(() => {
    const date = new BigNumber(item.expiredAt).shiftedBy(3).toNumber();
    const dateStr = formatDate(new Date(date), {
      hideSeconds: true,
    });
    return (
      <YStack
        gap="$1.5"
        justifyContent="flex-start"
        minWidth={gtMd ? 175 : 155}
      >
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.Limit_order_status_expired })}
        </SizableText>
        <SizableText size="$bodySm">{dateStr}</SizableText>
      </YStack>
    );
  }, [intl, item.expiredAt, gtMd]);

  const tokenInfo = useCallback(() => {
    const fromAmountFormatted = new BigNumber(fromAmount).shiftedBy(
      -(fromTokenInfo?.decimals ?? 0),
    );
    const toAmountFormatted = new BigNumber(toAmount).shiftedBy(
      -(toTokenInfo?.decimals ?? 0),
    );

    return (
      <XStack gap="$2" alignItems="center">
        <XStack gap="$1" alignItems="center">
          <Token size="xs" tokenImageUri={fromTokenInfo?.logoURI} />
          <NumberSizeableText size="$bodyMd" formatter="balance">
            {fromAmountFormatted.toFixed()}
          </NumberSizeableText>
          <SizableText size="$bodyMd">
            {fromTokenInfo?.symbol ?? '-'}
          </SizableText>
        </XStack>
        <SizableText size="$bodyMd">→</SizableText>
        <XStack gap="$1" alignItems="center">
          <Token size="xs" tokenImageUri={toTokenInfo?.logoURI} />
          <NumberSizeableText size="$bodyMd" formatter="balance">
            {toAmountFormatted.toFixed()}
          </NumberSizeableText>
          <SizableText size="$bodyMd">{toTokenInfo?.symbol ?? '-'}</SizableText>
        </XStack>
      </XStack>
    );
  }, [
    fromAmount,
    fromTokenInfo?.decimals,
    fromTokenInfo?.logoURI,
    fromTokenInfo?.symbol,
    toAmount,
    toTokenInfo?.decimals,
    toTokenInfo?.logoURI,
    toTokenInfo?.symbol,
  ]);
  const decimalsAmount = useMemo(
    () => ({
      fromAmount: new BigNumber(item?.fromAmount ?? '0').shiftedBy(
        -(item?.fromTokenInfo?.decimals ?? 0),
      ),
      toAmount: new BigNumber(item?.toAmount ?? '0').shiftedBy(
        -(item?.toTokenInfo?.decimals ?? 0),
      ),
    }),
    [
      item?.fromAmount,
      item?.fromTokenInfo?.decimals,
      item?.toAmount,
      item?.toTokenInfo?.decimals,
    ],
  );
  const limitPrice = useMemo(() => {
    const fromAmountNum = decimalsAmount.fromAmount;
    const toAmountNum = decimalsAmount.toAmount;
    const calculateLimitPrice = toAmountNum.div(fromAmountNum).toFixed();
    const formatLimitPrice = formatBalance(calculateLimitPrice);
    return formatLimitPrice.formattedValue;
  }, [decimalsAmount]);
  const renderLimitOrderPrice = useCallback(
    () => (
      <YStack
        gap="$1.5"
        justifyContent="flex-start"
        minWidth={gtMd ? 175 : 155}
      >
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.Limit_limit_price })}
        </SizableText>
        <SizableText size="$bodySm">
          {`1 ${item?.fromTokenInfo?.symbol ?? '-'} = ${limitPrice ?? '-'} ${
            item?.toTokenInfo?.symbol ?? '-'
          }`}
        </SizableText>
      </YStack>
    ),
    [item, limitPrice, intl, gtMd],
  );
  const renderLimitOrderStatus = useCallback(() => {
    const { status, executedSellAmount } = item ?? {};
    let label = intl.formatMessage({
      id: ETranslations.Limit_order_status_open,
    });
    let color = '@textCaution';
    if (status) {
      switch (status) {
        case ESwapLimitOrderStatus.CANCELLED:
          label = intl.formatMessage({
            id: ETranslations.Limit_order_cancel,
          });
          color = '@textCritical';
          break;
        case ESwapLimitOrderStatus.FULFILLED:
          label = intl.formatMessage({
            id: ETranslations.Limit_order_status_filled,
          });
          color = '$textSuccess';
          break;
        case ESwapLimitOrderStatus.EXPIRED:
          label = intl.formatMessage({
            id: ETranslations.Limit_order_status_expired,
          });
          break;
        case ESwapLimitOrderStatus.PRESIGNATURE_PENDING:
          label = intl.formatMessage({
            id: ETranslations.Limit_order_status_open,
          });
          break;
        default:
          break;
      }
    }

    const fromAmountBN = new BigNumber(fromAmount ?? '0').shiftedBy(
      -(fromTokenInfo?.decimals ?? 0),
    );
    const executedSellAmountBN = new BigNumber(
      executedSellAmount ?? '0',
    ).shiftedBy(-(fromTokenInfo?.decimals ?? 0));
    const sellPercentage = executedSellAmountBN
      .div(fromAmountBN)
      .multipliedBy(100)
      .toFixed(2);
    return (
      <YStack gap="$1.5">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.Limit_order_status })}
        </SizableText>
        <XStack gap="$2" alignItems="center">
          <SizableText size="$bodySm" color={color}>
            {label}
          </SizableText>
          <Progress
            w={progressWidth}
            h="$1"
            colors={['$neutral5', '$textSuccess']}
            value={Number(sellPercentage)}
          />
          <SizableText size="$bodySm">{`${sellPercentage}%`}</SizableText>
        </XStack>
      </YStack>
    );
  }, [item, intl, fromAmount, fromTokenInfo?.decimals, progressWidth]);

  return (
    <YStack
      flex={1}
      userSelect="none"
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
      onPress={onPress ?? (() => {})}
      bg="$bgSubdued"
      p="$4"
      borderRadius="$3"
      gap="$3"
    >
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack gap="$2">
          {createdAtFormat}
          {tokenInfo()}
        </YStack>
        {!hiddenCancelIcon ? (
          <IconButton
            icon="DeleteOutline"
            variant="tertiary"
            color="$iconSubdued"
            size="small"
            onPress={() => {
              onCancel?.();
            }}
            loading={cancelLoading}
          />
        ) : null}
      </XStack>
      <Divider />
      <XStack
        flexWrap="wrap"
        justifyContent="flex-start"
        gap={gtMd ? '$1' : '$3'}
      >
        {renderLimitOrderPrice()}
        {expirationTitle}
        {renderLimitOrderStatus()}
      </XStack>
    </YStack>
  );
};

export default LimitOrderCard;
