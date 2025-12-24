import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useCurrency } from '../../../components/Currency';
import { Token } from '../../../components/Token';

interface ISwapProPositionItemProps {
  token: ISwapToken;
  onPress: (token: ISwapToken) => void;
  disabled?: boolean;
}

const SwapProPositionItem = ({
  token,
  onPress,
  disabled,
}: ISwapProPositionItemProps) => {
  const intl = useIntl();
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

  return (
    <YStack
      py="$3"
      gap="$4"
      onPress={disabled ? undefined : () => onPress(token)}
      opacity={disabled ? 0.5 : 1}
    >
      <XStack alignItems="center" gap="$2">
        <Token
          size="sm"
          tokenImageUri={token.logoURI}
          networkImageUri={tokenNetworkImageUri}
        />
        <SizableText size="$headingLg">{token.symbol}</SizableText>
        <Icon name="ChevronRightOutline" size="$4" />
      </XStack>
      <XStack justifyContent="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_balance })}
        </SizableText>
        <XStack>
          <NumberSizeableText size="$bodyMdMedium" formatter="balance">
            {token.balanceParsed}
          </NumberSizeableText>
          <SizableText size="$bodyMdMedium">(</SizableText>
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="value"
            formatterOptions={{ currency: currencyInfo.symbol }}
          >
            {token.fiatValue}
          </NumberSizeableText>
          <SizableText size="$bodyMdMedium">)</SizableText>
        </XStack>
      </XStack>
    </YStack>
  );
};

export default SwapProPositionItem;
