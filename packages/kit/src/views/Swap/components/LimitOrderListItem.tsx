import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  NumberSizeableText,
  Progress,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';
import { ESwapLimitOrderStatus } from '@onekeyhq/shared/types/swap/types';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

import { ListItem } from '../../../components/ListItem';
import { Token } from '../../../components/Token';
import useFormatDate from '../../../hooks/useFormatDate';

interface ILimitOrderListItemProps {
  item: IFetchLimitOrderRes;
  cancelLoading?: boolean;
  onClickCell: (item: IFetchLimitOrderRes) => void;
  onCancel: (item: IFetchLimitOrderRes) => void;
}

const LimitOrderListItemAvatar = ({
  fromUri,
  toUri,
  toAmount,
  fromAmount,
  toSymbol,
  fromSymbol,
}: {
  fromUri: string;
  toUri: string;
  toAmount: string;
  fromAmount: string;
  toSymbol?: string;
  fromSymbol?: string;
}) => {
  const { gtMd } = useMedia();
  return (
    <YStack
      minWidth={gtMd ? 184 : 145}
      gap="$1"
      alignItems="flex-start"
      justifyContent="center"
    >
      <XStack gap="$1">
        <Token size="xs" tokenImageUri={toUri} />
        <SizableText size="$bodyMd" color="$textSubdued">
          +
        </SizableText>
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="balance"
        >
          {toAmount}
        </NumberSizeableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {toSymbol ?? ''}
        </SizableText>
      </XStack>
      <XStack gap="$1">
        <Token size="xs" tokenImageUri={fromUri} />
        <SizableText size="$bodyMd" color="$textSubdued">
          -
        </SizableText>
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="balance"
        >
          {fromAmount}
        </NumberSizeableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {fromSymbol ?? ''}
        </SizableText>
      </XStack>
    </YStack>
  );
};

const LimitOrderListItem = ({
  item,
  onClickCell,
  onCancel,
  cancelLoading,
}: ILimitOrderListItemProps) => {
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  const statusText = useMemo(() => {
    if (item.status === ESwapLimitOrderStatus.FULFILLED) {
      return (
        <SizableText size="$bodySm" color="$textSuccess">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_success,
          })}
        </SizableText>
      );
    }
    if (item.status === ESwapLimitOrderStatus.CANCELLED) {
      return (
        <SizableText size="$bodySm" color="$textCritical">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_canceled,
          })}
        </SizableText>
      );
    }
    if (item.status === ESwapLimitOrderStatus.EXPIRED) {
      return (
        <SizableText size="$bodySm" color="$textCritical">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_cancelling,
          })}
        </SizableText>
      );
    }
    if (item.status === ESwapLimitOrderStatus.OPEN) {
      return (
        <SizableText size="$bodySm" color="$textSuccess">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_canceled,
          })}
        </SizableText>
      );
    }
    if (item.status === ESwapLimitOrderStatus.PRESIGNATURE_PENDING) {
      return (
        <SizableText size="$bodySm" color="$textSuccess">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_pending,
          })}
        </SizableText>
      );
    }
    return null;
  }, [intl, item.status]);

  const expirationTitle = useMemo(() => {
    const date = new BigNumber(item.expiredAt).shiftedBy(3).toNumber();
    const dateStr = formatDate(new Date(date), {
      hideYear: false,
    });
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        {dateStr}
      </SizableText>
    );
  }, [formatDate, item.expiredAt]);

  const actionButton = useMemo(() => {
    if (item.status === ESwapLimitOrderStatus.OPEN) {
      return (
        <Button loading={cancelLoading} onPress={() => onCancel(item)}>
          {cancelLoading ? 'Cancelling...' : 'Cancel'}
        </Button>
      );
    }
    return null;
  }, [item, cancelLoading, onCancel]);

  const expirationComponent = useMemo(
    () => (
      <YStack flex={1} alignItems="flex-end" gap="$1" minWidth={80}>
        {expirationTitle}
        {actionButton}
      </YStack>
    ),
    [expirationTitle, actionButton],
  );

  const progressStatus = useMemo(() => {
    const percentage =
      item.status === ESwapLimitOrderStatus.FULFILLED ? 100 : 0;
    return (
      <YStack gap="$1" minWidth={80}>
        {statusText}
        <XStack>
          <XStack w="$12" h="$0.5" bg="$backgroundSubdued" />
          {/* <Progress value={percentage} /> */}
          <SizableText size="$bodySm" color="$textSubdued">
            {percentage}%
          </SizableText>
        </XStack>
      </YStack>
    );
  }, [item.status, statusText]);

  const decimalsAmount = useMemo(
    () => ({
      fromAmount: new BigNumber(item.fromAmount ?? '0').shiftedBy(
        -(item.fromTokenInfo?.decimals ?? 0),
      ),
      toAmount: new BigNumber(item.toAmount ?? '0').shiftedBy(
        -(item.toTokenInfo?.decimals ?? 0),
      ),
    }),
    [
      item.fromAmount,
      item.fromTokenInfo?.decimals,
      item.toAmount,
      item.toTokenInfo?.decimals,
    ],
  );

  const limitPrice = useMemo(() => {
    const fromAmountNum = decimalsAmount.fromAmount;
    const toAmountNum = decimalsAmount.toAmount;
    const calculateLimitPrice = toAmountNum.div(fromAmountNum).toString();
    const formatLimitPrice = formatBalance(calculateLimitPrice);
    return formatLimitPrice.formattedValue;
  }, [decimalsAmount]);
  const { gtMd } = useMedia();
  return (
    <>
      <Divider />
      <ListItem
        mx="-$4"
        borderRadius={0}
        onPress={() => onClickCell(item)}
        userSelect="none"
      >
        <LimitOrderListItemAvatar
          fromUri={item.fromTokenInfo?.logoURI ?? ''}
          toUri={item.toTokenInfo?.logoURI ?? ''}
          toAmount={decimalsAmount.toAmount.toFixed()}
          fromAmount={decimalsAmount.fromAmount.toFixed()}
          toSymbol={item.toTokenInfo?.symbol}
          fromSymbol={item.fromTokenInfo?.symbol}
        />
        {gtMd ? (
          <SizableText minWidth={184} size="$bodySm">
            {`1 ${item.fromTokenInfo?.symbol ?? '-'} = ${limitPrice ?? '-'} ${
              item.toTokenInfo?.symbol ?? '-'
            }`}
          </SizableText>
        ) : null}
        {progressStatus}
        {expirationComponent}
      </ListItem>
    </>
  );
};

export default LimitOrderListItem;
