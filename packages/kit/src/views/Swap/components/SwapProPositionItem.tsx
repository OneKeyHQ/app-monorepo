import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useCurrency } from '../../../components/Currency';
import { Token } from '../../../components/Token';

interface ISwapProPositionItemProps {
  token: ISwapToken;
  onPress: (token: ISwapToken) => void;
}

const SwapProPositionItem = ({ token, onPress }: ISwapProPositionItemProps) => {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const formatBalance = useMemo(() => {
    return numberFormat(token.balanceParsed ?? '0', {
      formatter: 'balance',
    });
  }, [token.balanceParsed]);
  const formatFiatValue = useMemo(() => {
    return numberFormat(token.fiatValue ?? '0', {
      formatter: 'value',
      formatterOptions: {
        currency: currencyInfo.symbol,
      },
    });
  }, [token.fiatValue, currencyInfo.symbol]);
  const balanceValue = useMemo(() => {
    return `${formatBalance}(${formatFiatValue})`;
  }, [formatBalance, formatFiatValue]);

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
    <YStack py="$3" gap="$4" onPress={() => onPress(token)}>
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
        <SizableText size="$bodyMdMedium">{balanceValue}</SizableText>
      </XStack>
    </YStack>
  );
};

export default SwapProPositionItem;
