import { useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

interface ISwapQuoteResultRateProps {
  rate?: string;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  providerIcon?: string;
  providerName?: string;
  isLoading?: boolean;
  onOpenResult?: () => void;
  openResult?: boolean;
}
const SwapQuoteResultRate = ({
  rate,
  fromToken,
  toToken,
  providerIcon,
  providerName,
  isLoading,
  onOpenResult,
  openResult,
}: ISwapQuoteResultRateProps) => {
  const intl = useIntl();
  const [isReverse, setIsReverse] = useState(false);
  const rateIsExit = useMemo(() => {
    const rateBN = new BigNumber(rate ?? 0);
    return !rateBN.isZero();
  }, [rate]);
  const rateContent = useMemo(() => {
    if (!onOpenResult || !fromToken || !toToken) {
      return (
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({
            id: ETranslations.swap_page_provider_provider_insufficient_liquidity,
          })}
        </SizableText>
      );
    }
    if (!rateIsExit) {
      return (
        <SizableText ml="$1" size="$bodyMdMedium">
          {intl.formatMessage({
            id: ETranslations.swap_page_provider_rate_unavailable,
          })}
        </SizableText>
      );
    }
    const rateBN = new BigNumber(rate ?? 0);
    return (
      <XStack
        gap="$2"
        alignItems="center"
        hoverStyle={{
          opacity: 0.5,
        }}
        onPress={(event) => {
          event.stopPropagation();
          setIsReverse(!isReverse);
        }}
        cursor="pointer"
      >
        <SizableText
          size="$bodyMdMedium"
          maxWidth={240}
          $gtMd={{
            maxWidth: 240,
          }}
          textAlign="right"
        >
          {`1 ${
            isReverse
              ? toToken.symbol.toUpperCase()
              : fromToken.symbol.toUpperCase()
          } = `}
          <NumberSizeableText size="$bodyMdMedium" formatter="balance">
            {isReverse
              ? new BigNumber(1).div(rateBN).toFixed()
              : rateBN.toFixed()}
          </NumberSizeableText>
          <SizableText size="$bodyMdMedium">
            {` ${isReverse ? fromToken.symbol : toToken.symbol}`}
          </SizableText>
        </SizableText>
      </XStack>
    );
  }, [fromToken, intl, isReverse, onOpenResult, rate, rateIsExit, toToken]);
  return (
    <XStack justifyContent="space-between" alignItems="center">
      {isLoading ? (
        <Stack py="$0.5">
          <Skeleton h="$4" w="$32" />
        </Stack>
      ) : (
        rateContent
      )}

      <XStack alignItems="center" userSelect="none" gap="$1">
        {!providerIcon || !fromToken || !toToken || !onOpenResult ? null : (
          <XStack
            animation="quick"
            y={openResult ? '$1' : '$0'}
            opacity={openResult ? 0 : 1}
          >
            <Image
              source={{ uri: providerIcon }}
              w="$5"
              h="$5"
              borderRadius="$1"
            />
            <SizableText
              numberOfLines={1}
              size="$bodyMdMedium"
              ml="$1"
              maxWidth={80}
              $gtMd={{
                maxWidth: 130,
              }}
            >
              {providerName ?? ''}
            </SizableText>
          </XStack>
        )}
        {!isLoading && onOpenResult ? (
          <Stack animation="quick" rotate={openResult ? '180deg' : '0deg'}>
            <Icon
              name="ChevronDownSmallOutline"
              color={openResult ? '$iconActive' : '$iconSubdued'}
              size="$5"
            />
          </Stack>
        ) : null}
      </XStack>
    </XStack>
  );
};
export default SwapQuoteResultRate;
