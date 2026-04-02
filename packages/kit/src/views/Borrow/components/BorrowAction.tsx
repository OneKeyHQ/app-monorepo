import { memo, useCallback } from 'react';

import { Button } from '@onekeyhq/components';
import type { IEarnClaimActionIcon } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { useBorrowActions } from '../hooks/useBorrowActions';

type IBorrowActionProps = {
  action?: IEarnClaimActionIcon;
  provider?: string;
  providerLogoURI?: string;
  networkId?: string;
  accountId?: string;
  symbol?: string;
  vault?: string;
  onSuccess?: () => Promise<void>;
};

const BorrowActionCmp = ({
  action,
  provider,
  providerLogoURI,
  networkId,
  accountId,
  symbol,
  vault,
  onSuccess,
}: IBorrowActionProps) => {
  const { handleAction, loading } = useBorrowActions({
    accountId: accountId ?? '',
    networkId,
    provider,
    providerLogoURI,
    symbol: symbol ?? '',
    vault,
    onSuccess,
  });

  const onPress = useCallback(() => {
    if (!action) return;
    handleAction({ actionIcon: action });
  }, [action, handleAction]);

  if (!action) return null;
  if (action.disabled) return null;

  const disabled = loading || action.disabled;

  return (
    <Button
      p="0"
      ai="center"
      size="small"
      variant="link"
      cursor={disabled ? 'not-allowed' : 'pointer'}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
    >
      <EarnText size="$bodyMdMedium" color="$textInfo" text={action.text} />
    </Button>
  );
};

export const BorrowAction = memo(BorrowActionCmp);
