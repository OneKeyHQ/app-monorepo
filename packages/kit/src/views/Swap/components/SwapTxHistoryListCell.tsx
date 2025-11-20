import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapExtraStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

import { Token } from '../../../components/Token';

interface ISwapTxHistoryListCellProps {
  item: ISwapTxHistory;
  onClickCell: () => void;
}

export const SwapTxHistoryAvatar = ({
  fromUri,
  toUri,
}: {
  fromUri: string;
  toUri: string;
}) => (
  <XStack
    w="$10"
    h="$10"
    userSelect="none"
    alignItems="center"
    pl="$1"
    pr="$2.5"
    py="$1"
  >
    <YStack
      borderWidth={2}
      borderRadius="$full"
      borderColor="$bg"
      bg="$bgSubdued"
    >
      <Token w="$8" h="$8" tokenImageUri={fromUri} />
    </YStack>
    <YStack
      borderWidth={2}
      borderRadius="$full"
      borderColor="$bg"
      ml="$-3.5"
      bg="$bgSubdued"
    >
      <Token w="$8" h="$8" tokenImageUri={toUri} />
    </YStack>
  </XStack>
);

const SwapTxHistoryListCell = ({
  item,
  onClickCell,
}: ISwapTxHistoryListCellProps) => {
  const intl = useIntl();
  const statusBadge = useMemo(() => {
    if (item.extraStatus === ESwapExtraStatus.HOLD) {
      return (
        <Badge badgeType="warning" badgeSize="lg">
          {intl.formatMessage({
            id: ETranslations.swap_ch_status_hold,
          })}
        </Badge>
      );
    }
    if (item.status === ESwapTxHistoryStatus.FAILED) {
      return (
        <Badge badgeType="critical" badgeSize="lg" borderRadius="$4">
          <SizableText size="$bodySm" color="$textCritical">
            {intl.formatMessage({
              id: ETranslations.swap_history_status_failed,
            })}
          </SizableText>
        </Badge>
      );
    }
    if (item.status === ESwapTxHistoryStatus.CANCELED) {
      return (
        <Badge badgeType="warning" badgeSize="lg">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_canceled,
          })}
        </Badge>
      );
    }
    if (item.status === ESwapTxHistoryStatus.CANCELING) {
      return (
        <Badge badgeType="warning" badgeSize="lg">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_cancelling,
          })}
        </Badge>
      );
    }
    return null;
  }, [intl, item.extraStatus, item.status]);
  const subContent = useMemo(() => {
    const isBridge =
      item.baseInfo?.fromNetwork?.networkId !==
      item.baseInfo?.toNetwork?.networkId;

    const fromNetworkName = item.baseInfo.fromNetwork?.name ?? '';
    const toNetworkName = item.baseInfo.toNetwork?.name ?? '';

    const chainDisplay = isBridge
      ? `${fromNetworkName} to ${toNetworkName}`
      : fromNetworkName;

    return chainDisplay;
  }, [
    item.baseInfo.fromNetwork?.networkId,
    item.baseInfo.fromNetwork?.name,
    item.baseInfo.toNetwork?.networkId,
    item.baseInfo.toNetwork?.name,
  ]);

  const title = useMemo(() => {
    // Determine if this is a bridge or swap transaction
    const isBridge =
      item.baseInfo?.fromNetwork?.networkId !==
      item.baseInfo?.toNetwork?.networkId;

    const displayText = intl.formatMessage({
      id: isBridge
        ? ETranslations.swap_page_bridge
        : ETranslations.swap_page_swap,
    });

    return displayText;
  }, [
    intl,
    item.baseInfo.fromNetwork?.networkId,
    item.baseInfo.toNetwork?.networkId,
  ]);
  const fromTokenAmountFinal = useMemo(() => {
    const extraAmount = item.swapInfo.otherFeeInfos?.find((extraItem) =>
      equalTokenNoCaseSensitive({
        token1: extraItem.token,
        token2: item.baseInfo.fromToken,
      }),
    )?.amount;
    return new BigNumber(item.baseInfo.fromAmount)
      .plus(extraAmount ?? 0)
      .toFixed();
  }, [
    item.baseInfo.fromAmount,
    item.baseInfo.fromToken,
    item.swapInfo.otherFeeInfos,
  ]);
  return (
    <XStack overflow="visible" flex={1} px="$4">
      <XStack
        mx="$-2"
        px="$2"
        py="$2.5"
        flex={1}
        onPress={onClickCell}
        userSelect="none"
        justifyContent="space-between"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        borderRadius="$3"
        alignItems="center"
        cursor="pointer"
      >
        <XStack alignItems="center" gap="$8">
          <SwapTxHistoryAvatar
            fromUri={item.baseInfo.fromToken.logoURI ?? ''}
            toUri={item.baseInfo.toToken.logoURI ?? ''}
          />
          <YStack>
            <XStack alignItems="center" gap="$1.5">
              <SizableText
                size="$bodyMdMedium"
                flexShrink={1}
                numberOfLines={1}
                pointerEvents="none"
              >
                {title}
              </SizableText>
              {statusBadge}
            </XStack>
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              flexShrink={1}
              numberOfLines={1}
              pointerEvents="none"
            >
              {subContent}
            </SizableText>
          </YStack>
        </XStack>
        <YStack>
          <SizableText
            size="$bodyMdMedium"
            color="$textSuccess"
            textAlign="right"
            pointerEvents="none"
          >
            +
            <NumberSizeableText
              size="$bodyMdMedium"
              color="$textSuccess"
              formatter="balance"
              pointerEvents="none"
            >
              {item.baseInfo.toAmount}
            </NumberSizeableText>{' '}
            <SizableText
              size="$bodyMdMedium"
              color="$textSuccess"
              pointerEvents="none"
            >
              {item.baseInfo?.toToken?.symbol ?? ''}
            </SizableText>
          </SizableText>
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            textAlign="right"
            pointerEvents="none"
          >
            -
            <NumberSizeableText
              size="$bodySm"
              color="$textSubdued"
              formatter="balance"
              pointerEvents="none"
            >
              {fromTokenAmountFinal}
            </NumberSizeableText>{' '}
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              pointerEvents="none"
            >
              {item.baseInfo?.fromToken?.symbol ?? ''}
            </SizableText>
          </SizableText>
        </YStack>
      </XStack>
    </XStack>
  );
};

export default SwapTxHistoryListCell;
