import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { InfoItemLabel } from './InfoItemLabel';

import type { IToken } from '../types';
import type BigNumber from 'bignumber.js';

export interface IBalanceDisplayProps {
  balance?: BigNumber;
  token?: IToken;
}

export function BalanceDisplay({ balance, token }: IBalanceDisplayProps) {
  const intl = useIntl();
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <InfoItemLabel
        title={intl.formatMessage({ id: ETranslations.global_balance })}
      />

      <SizableText size="$bodyMdMedium">
        {balance?.toFixed() || '-'} {token?.symbol || ''}
      </SizableText>
    </XStack>
  );
}
