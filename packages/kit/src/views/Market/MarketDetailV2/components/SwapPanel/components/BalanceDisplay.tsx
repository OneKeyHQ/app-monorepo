import { useIntl } from 'react-intl';

import { SizableText, Skeleton, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useSwapPanel } from '../hooks/useSwapPanel';

import { InfoItemLabel } from './InfoItemLabel';

import type { IToken } from '../types';

export interface IBalanceDisplayProps {
  onBalanceClick?: () => void;
}

export function BalanceDisplay({ onBalanceClick }: IBalanceDisplayProps) {
  const intl = useIntl();

  // Get state from atoms
  const { balance, balanceToken, fetchBalanceLoading } = useSwapPanel();

  const token = balanceToken as IToken;
  const isLoading = fetchBalanceLoading;

  return (
    <XStack justifyContent="space-between" alignItems="center" minHeight="$6">
      <InfoItemLabel
        title={intl.formatMessage({ id: ETranslations.global_balance })}
      />

      {isLoading ? (
        <Skeleton height="$5" width="$24" />
      ) : (
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
      )}
    </XStack>
  );
}
