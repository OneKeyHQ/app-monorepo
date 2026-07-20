import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Skeleton, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useSwapProAccount } from '../../hooks/useSwapPro';
import { ESwapProAccountStatus } from '../../utils/swapProAccountUtils';

interface ISwapProAccountSelectProps {
  onSelectAccountClick: () => void;
}

const SwapProAccountSelect = ({
  onSelectAccountClick,
}: ISwapProAccountSelectProps) => {
  const intl = useIntl();
  const netAccountRes = useSwapProAccount();
  // A connected account being resolved for the current network must not flash
  // as "Select wallet" — that state is reserved for truly missing accounts.
  const isAccountPending =
    netAccountRes?.accountStatus === ESwapProAccountStatus.PENDING;
  const accountValue = useMemo(() => {
    if (!netAccountRes?.result?.address) {
      return intl.formatMessage({ id: ETranslations.global_select_wallet });
    }
    return accountUtils.shortenAddress({
      address: netAccountRes?.result?.address ?? '',
      leadingLength: 6,
      trailingLength: 4,
    });
  }, [netAccountRes?.result?.address, intl]);
  return (
    <XStack
      onPress={onSelectAccountClick}
      justifyContent="space-between"
      py="$1"
    >
      <XStack gap="$1.5">
        <Icon name="WalletOutline" size="$4" color="$iconSubdued" />
        <SizableText size="$bodySm" color="$textSubdued">
          {netAccountRes?.result?.name}
        </SizableText>
      </XStack>
      <XStack>
        {isAccountPending ? (
          <Skeleton width="$20" height="$4" borderRadius="$full" />
        ) : (
          <SizableText size="$bodySm" numberOfLines={1} flexShrink={1}>
            {accountValue}
          </SizableText>
        )}
        <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
};

export default SwapProAccountSelect;
