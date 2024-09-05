import { memo, useCallback, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
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
        ? tokenPairs
        : tokenPairs.slice(0, needFoldingMinCount - 1);

    return (
      <XStack pt="$1" pb="$3" gap="$1.5" flexWrap="wrap">
        <>
          {tokenPairsToShow.map((tokenPair) => (
            <Button
              key={`${tokenPair.fromToken.contractAddress}-${tokenPair.toToken.contractAddress}`}
              variant="secondary"
              borderRadius="$4"
              px="$1.5"
              size="small"
              borderColor="$borderSubdued"
              flexDirection="row"
              justifyContent="center"
              alignItems="center"
              backgroundColor="$background"
              onPress={() => {
                onSelectTokenPairs(tokenPair);
              }}
            >
              <SizableText size="$bodyMdMedium">{`${tokenPair.fromToken.symbol}/${tokenPair.toToken.symbol}`}</SizableText>
            </Button>
          ))}
          {tokenPairs.length >= needFoldingMinCount ? (
            <Button
              key="more-token-pairs"
              variant="secondary"
              borderRadius="$4"
              px="$1.5"
              size="small"
              borderColor="$borderSubdued"
              flexDirection="row"
              justifyContent="center"
              alignItems="center"
              backgroundColor="$background"
              onPress={() => {
                setOpenMore(!openMore);
              }}
            >
              <Stack
                flex={1}
                animation="quick"
                rotate={openMore ? '180deg' : '0deg'}
              >
                <Icon
                  name="ChevronDownSmallOutline"
                  color={openMore ? '$iconActive' : '$iconSubdued'}
                  size="$5"
                />
              </Stack>
            </Button>
          ) : null}
        </>
      </XStack>
    );
  }, [onSelectTokenPairs, openMore, tokenPairs]);
  if (!fromTokenAmountBN.isZero() && !fromTokenAmountBN.isNaN()) {
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
