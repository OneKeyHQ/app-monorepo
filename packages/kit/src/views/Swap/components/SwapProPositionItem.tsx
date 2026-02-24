import { useCallback, useMemo } from 'react';

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
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useCurrency } from '../../../components/Currency';
import { Token } from '../../../components/Token';

interface ISwapProPositionItemProps {
  token: ISwapToken;
  onPress: (token: ISwapToken) => void;
  disabled?: boolean;
  props?: IStackProps;
}

const SwapProPositionItem = ({
  token,
  onPress,
  disabled,
  props,
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
      {/* First Column: Token Icon + Symbol + Arrow (original style) */}
      <XStack alignItems="center" gap="$2" flexGrow={1} flexBasis={0}>
        <Token
          size="md"
          tokenImageUri={token.logoURI}
          networkImageUri={tokenNetworkImageUri}
        />
        <SizableText size="$headingLg">{token.symbol}</SizableText>
        <Icon name="ChevronRightOutline" size="$4" />
      </XStack>

      {/* Second Column: Balance + Fiat Value */}
      <YStack alignItems="flex-end" flexGrow={1} flexBasis={0}>
        <NumberSizeableText
          size="$bodyMdMedium"
          formatter="balance"
          numberOfLines={1}
        >
          {token.balanceParsed}
        </NumberSizeableText>
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{ currency: currencyInfo.symbol }}
          numberOfLines={1}
        >
          {token.fiatValue}
        </NumberSizeableText>
      </YStack>
    </Stack>
  );
};

export default SwapProPositionItem;
