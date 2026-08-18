import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Empty, YStack, useClipboard } from '@onekeyhq/components';
import { useReferralUrl } from '@onekeyhq/kit/src/views/Perp/components/PositionShare/useReferralUrl';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function SwapEmptyData() {
  const intl = useIntl();
  const { copyUrl } = useClipboard();
  const { referralQrCodeUrl, isReady } = useReferralUrl('swap');

  const handleCopyLink = useCallback(() => {
    copyUrl(referralQrCodeUrl);
  }, [copyUrl, referralQrCodeUrl]);

  return (
    <YStack ai="center" py="$8">
      <Empty
        mt="$-10"
        illustration="ShakeHands"
        title={intl.formatMessage({
          id: ETranslations.referral_referred_empty,
        })}
        description={intl.formatMessage({
          id: ETranslations.referral_referred_empty_desc,
        })}
        buttonProps={{
          testID: 'swap-reward-copy-link-btn',
          variant: 'primary',
          loading: !isReady,
          onPress: handleCopyLink,
          children: intl.formatMessage({ id: ETranslations.browser_copy_link }),
        }}
      />
    </YStack>
  );
}
