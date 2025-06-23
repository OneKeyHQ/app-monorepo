import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { InfoItemLabel } from './InfoItemLabel';

import type { IToken } from '../types';
import type BigNumber from 'bignumber.js';

export interface IBalanceDisplayProps {
  balance?: BigNumber;
  token?: IToken;
  onBalanceClick?: () => void;
}

export function BalanceDisplay({
  balance,
  token,
  onBalanceClick,
}: IBalanceDisplayProps) {
  const intl = useIntl();
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <InfoItemLabel
        title={intl.formatMessage({ id: ETranslations.global_balance })}
      />

      <SizableText
        size="$bodyMdMedium"
        onPress={onBalanceClick}
        userSelect="none"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        borderRadius="$2"
        px="$1"
        py="$0.5"
      >
        {balance?.toFixed() || '-'} {token?.symbol || ''}
      </SizableText>
    </XStack>
  );
}
