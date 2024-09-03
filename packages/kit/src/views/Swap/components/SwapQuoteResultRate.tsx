import { useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import {
  Divider,
  IconButton,
  Image,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
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
  const { md } = useMedia();
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
      <XStack gap="$2" alignItems="center">
        <SizableText
          size="$bodyMdMedium"
          pl="$1"
          maxWidth={md ? 240 : 360}
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
        <IconButton
          size="small"
          icon="RepeatOutline"
          variant="tertiary"
          hoverStyle={{
            bg: '$background',
          }}
          pressStyle={{
            bg: '$background',
          }}
          onPress={() => {
            setIsReverse(!isReverse);
          }}
        />
      </XStack>
    );
  }, [fromToken, intl, isReverse, md, onOpenResult, rate, rateIsExit, toToken]);
  return (
    <YStack>
      <XStack justifyContent="space-between" alignItems="center">
        {isLoading ? (
          <Stack py="$1">
            <Skeleton h="$3" w="$24" />
          </Stack>
        ) : (
          rateContent
        )}

        <XStack alignItems="center" userSelect="none" gap="$1">
          {!providerIcon || !fromToken || !toToken || openResult ? null : (
            <>
              <Image
                source={{ uri: providerIcon }}
                w="$5"
                h="$5"
                borderRadius="$1"
              />
              <SizableText size="$bodyMdMedium" ml="$1">
                {providerName ?? ''}
              </SizableText>
            </>
          )}
          {onOpenResult ? (
            <MotiView
              {...(openResult
                ? {
                    from: {
                      rotate: '0deg',
                    },
                    animate: {
                      rotate: '180deg',
                    },
                  }
                : {
                    from: {
                      rotate: '180deg',
                    },
                    animate: {
                      rotate: '0deg',
                    },
                  })}
              transition={{
                type: 'timing',
                duration: 150,
              }}
            >
              <IconButton
                size="small"
                icon="ChevronDownSmallSolid"
                variant="tertiary"
                onPress={onOpenResult}
                hoverStyle={{
                  bg: '$background',
                }}
                pressStyle={{
                  bg: '$background',
                }}
              />
            </MotiView>
          ) : null}
        </XStack>
      </XStack>
      {openResult ? <Divider mt="$2" /> : null}
    </YStack>
  );
};
export default SwapQuoteResultRate;
