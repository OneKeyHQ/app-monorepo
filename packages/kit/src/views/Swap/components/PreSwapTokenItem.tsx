import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { NumberSizeableText, XStack, YStack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { Token } from '../../../components/Token';

interface IPreSwapTokenItemProps {
  token?: ISwapToken;
  amount: string;
}

const PreSwapTokenItem = ({ token, amount }: IPreSwapTokenItemProps) => {
  const fiatValue = useMemo(() => {
    return token?.price && amount
      ? new BigNumber(token?.price ?? 0).multipliedBy(amount).toFixed()
      : '0';
  }, [token?.price, amount]);
  const [settings] = useSettingsPersistAtom();
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <YStack gap="$2">
        <NumberSizeableText
          size="$heading3xl"
          formatter="balance"
          formatterOptions={{
            tokenSymbol: token?.symbol ?? '-',
          }}
        >
          {amount}
        </NumberSizeableText>
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {fiatValue}
        </NumberSizeableText>
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
