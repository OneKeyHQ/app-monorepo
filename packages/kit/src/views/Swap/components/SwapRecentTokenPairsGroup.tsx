import { memo, useCallback, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  HeightTransition,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

const needFoldingMinCount = 6;

interface ISwapRecentTokenPairsGroupProps {
  fromTokenAmount?: string;
  onSelectTokenPairs: ({
    fromToken,
    toToken,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
  }) => void;
  tokenPairs: { fromToken: ISwapToken; toToken: ISwapToken }[];
}

const SwapRecentTokenPairsGroup = ({
  onSelectTokenPairs,
  tokenPairs,
  fromTokenAmount,
}: ISwapRecentTokenPairsGroupProps) => {
  const intl = useIntl();
  const [openMore, setOpenMore] = useState(false);
  const fromTokenAmountBN = new BigNumber(fromTokenAmount ?? 0);
  const rerenderRecentTokenPairs = useCallback(() => {
    const tokenPairsToShow =
      !openMore && tokenPairs.length >= needFoldingMinCount
        ? tokenPairs.slice(0, needFoldingMinCount - 1)
        : tokenPairs;

    return (
      <XStack pt="$1" pb="$3" gap="$1.5" flexWrap="wrap">
        <>
          {tokenPairsToShow.map((tokenPair) => (
            <XStack
              key={`${tokenPair.fromToken.contractAddress}-${tokenPair.toToken.contractAddress}`}
              role="button"
              userSelect="none"
              alignItems="center"
              px="$1.5"
              py="$1"
              bg="$bg"
              borderRadius="$4"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusable
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
                outlineWidth: 2,
                outlineOffset: 2,
              }}
              onPress={() => {
                onSelectTokenPairs(tokenPair);
              }}
            >
              <SizableText size="$bodyMdMedium">{`${tokenPair.fromToken.symbol}/${tokenPair.toToken.symbol}`}</SizableText>
            </XStack>
          ))}
          {tokenPairs.length >= needFoldingMinCount ? (
            <Stack
              key="more-token-pairs"
              role="button"
              userSelect="none"
              alignItems="center"
              px="$1.5"
              py="$1"
              bg="$bg"
              borderRadius="$4"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusable
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
                outlineWidth: 2,
                outlineOffset: 2,
              }}
              onPress={() => {
                setOpenMore(!openMore);
              }}
            >
              <Stack
                animation="quick"
                justifyContent="center"
                alignItems="center"
                rotate={openMore ? '180deg' : '0deg'}
              >
                <Icon
                  name="ChevronDownSmallOutline"
                  color={openMore ? '$iconActive' : '$iconSubdued'}
                  size="$5"
                />
              </Stack>
            </Stack>
          ) : null}
        </>
      </XStack>
    );
  }, [onSelectTokenPairs, openMore, tokenPairs]);
  if (
    (!fromTokenAmountBN.isZero() && !fromTokenAmountBN.isNaN()) ||
    !tokenPairs?.length
  ) {
    return null;
  }

  return (
    <HeightTransition>
      <YStack gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.swap_page_recent_trade })}
        </SizableText>
        {rerenderRecentTokenPairs()}
      </YStack>
    </HeightTransition>
  );
};

export default memo(SwapRecentTokenPairsGroup);
