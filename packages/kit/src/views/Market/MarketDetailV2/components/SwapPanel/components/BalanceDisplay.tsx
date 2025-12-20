import { useIntl } from 'react-intl';

import { NumberSizeableText, Skeleton, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { InfoItemLabel } from './InfoItemLabel';

import type { IToken } from '../types';
import type BigNumber from 'bignumber.js';

export interface IBalanceDisplayProps {
  balance?: BigNumber;
  token?: IToken;
  isLoading?: boolean;
  onBalanceClick?: () => void;
}

export function BalanceDisplay({
  balance,
  token,
  isLoading = false,
  onBalanceClick,
}: IBalanceDisplayProps) {
  const intl = useIntl();
  return (
    <XStack justifyContent="space-between" alignItems="center" height="$6">
      <InfoItemLabel
        title={intl.formatMessage({ id: ETranslations.global_balance })}
      />

      {isLoading ? (
        <Skeleton height="$6" width="$24" />
      ) : (
        <NumberSizeableText
          size="$bodyMdMedium"
          onPress={onBalanceClick}
          userSelect="none"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          borderRadius="$2"
          formatter="balance"
          formatterOptions={{
            tokenSymbol: token?.symbol,
          }}
          contentStyle={{
            px: '$1',
            py: '$0.5',
          }}
        >
          {balance?.toFixed()}
        </NumberSizeableText>
      )}
    </XStack>
  );
}
