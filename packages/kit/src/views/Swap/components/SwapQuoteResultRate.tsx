import { useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  type ColorTokens,
  Divider,
  Icon,
  Image,
  LottieView,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY_TRANSFORM,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapRefreshButton from './SwapRefreshButton';

interface ISwapQuoteResultRateProps {
  rate?: string;
  isBest?: boolean;
  showBestBadge?: boolean;
  customSlippageValue?: string;
  customSlippageTextColor?: ColorTokens;
  customSlippageIconColor?: ColorTokens;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  providerIcon?: string;
  providerName?: string;
  quoting?: boolean;
  isLoading?: boolean;
  onOpenResult?: () => void;
  refreshAction: (manual?: boolean) => void;
  openResult?: boolean;
}
const SwapQuoteResultRate = ({
  rate,
  isBest,
  showBestBadge = true,
  customSlippageValue,
  customSlippageTextColor = '$textSubdued',
  customSlippageIconColor = '$iconSubdued',
  quoting,
  fromToken,
  toToken,
  providerIcon,
  isLoading,
  onOpenResult,
  openResult,
  refreshAction,
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
        <SizableText size="$bodyMdMedium" flexShrink={1} minWidth={0}>
          {intl.formatMessage({
            id: ETranslations.swap_page_provider_provider_insufficient_liquidity,
          })}
        </SizableText>
      );
    }
    if (!rateIsExit) {
      return (
        <SizableText ml="$1" size="$bodyMd" flexShrink={1} minWidth={0}>
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
        flex={1}
        flexBasis={0}
        minWidth={0}
        hoverStyle={{
          opacity: 0.5,
        }}
        onPress={(event) => {
          event.stopPropagation();
          setIsReverse(!isReverse);
        }}
        cursor="pointer"
      >
        <SizableText size="$bodyMd" flex={1} flexBasis={0} minWidth={0}>
          {`1 ${
            isReverse
              ? (toToken?.symbol?.toUpperCase() ?? '-')
              : (fromToken?.symbol?.toUpperCase() ?? '-')
          } = `}
          <NumberSizeableText
            size="$bodyMd"
            formatter={rateBN.gte(1_000_000) ? 'marketCap' : 'balance'}
          >
            {isReverse
              ? new BigNumber(1).div(rateBN).toFixed()
              : rateBN.toFixed()}
          </NumberSizeableText>
          <SizableText size="$bodyMd">
            {` ${isReverse ? fromToken.symbol : toToken.symbol}`}
          </SizableText>
        </SizableText>
      </XStack>
    );
  }, [fromToken, intl, isReverse, onOpenResult, rate, rateIsExit, toToken]);
  return (
    <XStack alignItems="center" gap="$2" width="100%">
      {isLoading ? (
        <XStack gap="$2">
          <SizableText size="$bodyMd" color="$text">
            {intl.formatMessage({
              id: ETranslations.swap_loading_content,
            })}
          </SizableText>
        </XStack>
      ) : (
        <XStack
          gap="$1"
          alignItems="center"
          flexGrow={1}
          flexShrink={1}
          flexBasis={0}
          minWidth={0}
        >
          <Stack flexShrink={0}>
            <SwapRefreshButton refreshAction={refreshAction} />
          </Stack>
          {rateContent}
        </XStack>
      )}

      <XStack alignItems="center" userSelect="none" gap="$1" flexShrink={0}>
        {!providerIcon ||
        !fromToken ||
        !toToken ||
        !onOpenResult ||
        quoting ? null : (
          <XStack
            alignItems="center"
            gap="$2"
            flexShrink={0}
            animation="quick"
            animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
            y={openResult ? '$1' : '$0'}
            opacity={openResult ? 0 : 1}
          >
            {isBest && showBestBadge ? (
              <Badge badgeSize="sm" badgeType="success">
                {intl.formatMessage({
                  id: ETranslations.global_best,
                })}
              </Badge>
            ) : null}
            {customSlippageValue ? (
              <>
                <XStack gap="$1" alignItems="center" flexShrink={0}>
                  <Icon
                    name="SliderVerOutline"
                    size="$5"
                    color={customSlippageIconColor}
                  />
                  <SizableText
                    size="$bodyMdMedium"
                    color={customSlippageTextColor}
                    flexShrink={0}
                    numberOfLines={1}
                  >
                    {customSlippageValue}
                  </SizableText>
                </XStack>
                <Divider vertical h="$5" borderColor="$border" flexShrink={0} />
              </>
            ) : null}
            <Stack position="relative" w="$5" h="$5">
              <Image
                source={{ uri: providerIcon }}
                w="$5"
                h="$5"
                borderRadius="$1"
              />
              <Stack
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                borderRadius="$1"
                borderWidth="$px"
                borderColor="$borderSubdued"
                pointerEvents="none"
              />
            </Stack>
          </XStack>
        )}
        {!quoting && onOpenResult ? (
          <Stack
            animation="quick"
            animateOnly={ANIMATE_ONLY_TRANSFORM}
            rotate={openResult ? '180deg' : '0deg'}
          >
            <Icon
              name="ChevronDownSmallOutline"
              color={openResult ? '$iconActive' : '$iconSubdued'}
              size="$5"
            />
          </Stack>
        ) : (
          <XStack justifyContent="flex-end" flexShrink={0}>
            {quoting ? (
              <LottieView
                source={require('@onekeyhq/kit/assets/animations/swap_loading.json')}
                autoPlay
                loop
                style={{
                  width: 48,
                  height: 20,
                }}
              />
            ) : null}
            {onOpenResult ? (
              <Stack
                animation="quick"
                animateOnly={ANIMATE_ONLY_TRANSFORM}
                rotate={openResult ? '180deg' : '0deg'}
              >
                <Icon
                  name="ChevronDownSmallOutline"
                  color={openResult ? '$iconActive' : '$iconSubdued'}
                  size="$5"
                />
              </Stack>
            ) : null}
          </XStack>
        )}
      </XStack>
    </XStack>
  );
};
export default SwapQuoteResultRate;
