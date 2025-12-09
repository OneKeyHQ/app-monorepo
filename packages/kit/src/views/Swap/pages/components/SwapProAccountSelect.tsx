import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useSwapProAccount } from '../../hooks/useSwapPro';

interface ISwapProAccountSelectProps {
  onSelectAccountClick: () => void;
}

const SwapProAccountSelect = ({
  onSelectAccountClick,
}: ISwapProAccountSelectProps) => {
  const intl = useIntl();
  const netAccountRes = useSwapProAccount();
  const accountValue = useMemo(() => {
    if (!netAccountRes?.result?.address) {
      return intl.formatMessage({ id: ETranslations.global_select_wallet });
    }
    return accountUtils.shortenAddress({
      address: netAccountRes?.result?.address ?? '',
      leadingLength: 6,
      trailingLength: 3,
    });
  }, [netAccountRes?.result?.address, intl]);
  return (
    <XStack
      onPress={onSelectAccountClick}
      justifyContent="space-between"
      my="$1"
    >
      <XStack gap="$1.5">
        <Icon name="WalletOutline" size="$4" color="$iconSubdued" />
        <SizableText size="$bodySm">{netAccountRes?.result?.name}</SizableText>
      </XStack>
      <XStack gap="$1.5">
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={1}
        >
          {accountValue}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
};

export default SwapProAccountSelect;
