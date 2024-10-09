import { memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapTypeSwitchAtom } from '../../../states/jotai/contexts/swap';

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
  const [swapTypeSwitchAtom] = useSwapTypeSwitchAtom();
  const fromTokenAmountBN = new BigNumber(fromTokenAmount ?? 0);
  const tokenPairsInCurrentType = useMemo(() => {
    if (swapTypeSwitchAtom === ESwapTabSwitchType.BRIDGE) {
      return tokenPairs?.filter(
        (tokens) => tokens.fromToken.networkId !== tokens.toToken.networkId,
      );
    }
    if (swapTypeSwitchAtom === ESwapTabSwitchType.SWAP) {
      return tokenPairs?.filter(
        (tokens) => tokens.toToken.networkId === tokens.fromToken.networkId,
      );
    }
    return [];
  }, [swapTypeSwitchAtom, tokenPairs]);
  const rerenderRecentTokenPairs = useCallback(() => {
    const tokenPairsToShow =
      !openMore && tokenPairsInCurrentType.length >= needFoldingMinCount
        ? tokenPairsInCurrentType.slice(0, needFoldingMinCount - 1)
        : tokenPairsInCurrentType;
    return (
      <XStack pt="$1" pb="$3" gap="$1.5" flexWrap="wrap">
        <>
          {tokenPairsToShow.map((tokenPair, index) => (
            <XStack
              key={index}
              role="button"
              userSelect="none"
              alignItems="center"
              px="$2"
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
          {tokenPairsInCurrentType.length >= needFoldingMinCount ? (
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
  }, [onSelectTokenPairs, openMore, tokenPairsInCurrentType]);
  if (
    (!fromTokenAmountBN.isZero() && !fromTokenAmountBN.isNaN()) ||
    !tokenPairsInCurrentType?.length
  ) {
    return null;
  }

  return (
    <YStack gap="$1">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.swap_page_recent_trade })}
      </SizableText>
      {rerenderRecentTokenPairs()}
    </YStack>
  );
};

export default memo(SwapRecentTokenPairsGroup);
