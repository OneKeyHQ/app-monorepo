import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { IStackProps } from '@onekeyhq/components';
import {
  Icon,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketAccountPortfolioPnl } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useCurrency } from '../../../components/Currency';
import { Token } from '../../../components/Token';

interface ISwapProPositionItemProps {
  token: ISwapToken;
  onPress: (token: ISwapToken) => void;
  disabled?: boolean;
  props?: IStackProps;
  pnl?: IMarketAccountPortfolioPnl;
}

const SwapProPositionItem = ({
  token,
  onPress,
  disabled,
  props,
  pnl,
}: ISwapProPositionItemProps) => {
  const currencyInfo = useCurrency();

  const tokenNetworkImageUri = useMemo(() => {
    if (token.networkLogoURI) {
      return token.networkLogoURI;
    }
    if (token.networkId) {
      const localNetwork = networkUtils.getLocalNetworkInfo(token.networkId);
      return localNetwork?.logoURI;
    }
    return '';
  }, [token.networkLogoURI, token.networkId]);

  const handlePress = useCallback(() => {
    if (!disabled) {
      onPress(token);
    }
  }, [disabled, onPress, token]);

  const pnlDisplay = useMemo(() => {
    if (!pnl?.isPnlSupported) return null;
    const unrealizedBN = new BigNumber(pnl.unrealizedPnlUsd);
    if (unrealizedBN.isNaN()) return null;

    const isPositive = unrealizedBN.gt(0);
    const isNegative = unrealizedBN.lt(0);

    let color = '$textSubdued';
    if (isPositive) color = '$textSuccess';
    if (isNegative) color = '$textCritical';

    let prefix = '';
    if (isPositive) prefix = '+';
    if (isNegative) prefix = '-';

    return {
      text: `${prefix}$${unrealizedBN.abs().toFixed(2)} (${pnl.unrealizedPnlPercent}%)`,
      color,
    };
  }, [pnl]);

  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      minHeight="$11"
      gap="$3"
      py="$2"
      px="$2"
      mx="$-2"
      borderRadius="$3"
      borderCurve="continuous"
      userSelect="none"
      onPress={handlePress}
      {...(disabled && { opacity: 0.5 })}
      {...(!disabled && listItemPressStyle)}
      {...props}
    >
      <XStack alignItems="center" gap="$2" flexGrow={1} flexBasis={0}>
        <Token
          size="md"
          tokenImageUri={token.logoURI}
          networkImageUri={tokenNetworkImageUri}
        />
        <YStack>
          <XStack alignItems="center" gap="$0.5">
            <SizableText size="$bodyLgMedium">{token.symbol}</SizableText>
            <Icon name="ChevronRightSmallOutline" size="$5" />
          </XStack>
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="balance"
            numberOfLines={1}
          >
            {token.balanceParsed}
          </NumberSizeableText>
        </YStack>
      </XStack>

      <YStack alignItems="flex-end" flexShrink={0}>
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="value"
          formatterOptions={{ currency: currencyInfo.symbol }}
          numberOfLines={1}
        >
          {token.fiatValue}
        </NumberSizeableText>
        {pnlDisplay ? (
          <SizableText
            size="$bodyMd"
            color={pnlDisplay.color}
            numberOfLines={1}
          >
            {pnlDisplay.text}
          </SizableText>
        ) : null}
      </YStack>
    </Stack>
  );
};

export default SwapProPositionItem;
