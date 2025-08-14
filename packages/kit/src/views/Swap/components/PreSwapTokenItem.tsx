import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Icon,
  NumberSizeableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { Token } from '../../../components/Token';

interface IPreSwapTokenItemProps {
  token?: ISwapToken;
  amount: string;
  loading?: boolean;
  isFloating?: boolean;
}

const PreSwapTokenItem = ({
  token,
  amount,
  loading,
  isFloating,
}: IPreSwapTokenItemProps) => {
  const fiatValue = useMemo(() => {
    return token?.price && amount
      ? new BigNumber(token?.price ?? 0).multipliedBy(amount).toFixed()
      : '0';
  }, [token?.price, amount]);
  const [settings] = useSettingsPersistAtom();
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      flex={1}
      mr="$0.5"
    >
      <YStack gap="$1" flex={1}>
        {loading ? (
          <>
            <Skeleton width={180} height={36} />
            <Skeleton width={60} height={20} />
          </>
        ) : (
          <>
            <XStack alignItems="center">
              {isFloating ? (
                <Icon name="TildeOutline" size="$5" color="$text" />
              ) : null}
              <NumberSizeableText
                size="$heading3xl"
                formatter="balance"
                formatterOptions={{
                  tokenSymbol: token?.symbol ?? '-',
                }}
              >
                {amount}
              </NumberSizeableText>
            </XStack>
            <NumberSizeableText
              size="$bodyMd"
              color="$textSubdued"
              formatter="value"
              formatterOptions={{
                currency: settings.currencyInfo.symbol,
              }}
              numberOfLines={1}
            >
              {fiatValue}
            </NumberSizeableText>
          </>
        )}
      </YStack>
      <Token
        tokenImageUri={token?.logoURI}
        networkImageUri={token?.networkLogoURI}
        size="lg"
      />
    </XStack>
  );
};

export default PreSwapTokenItem;
