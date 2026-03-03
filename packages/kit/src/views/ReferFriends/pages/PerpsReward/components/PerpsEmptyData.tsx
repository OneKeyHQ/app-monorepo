import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Empty, YStack, useClipboard } from '@onekeyhq/components';
import { useReferralUrl } from '@onekeyhq/kit/src/views/Perp/components/PositionShare/useReferralUrl';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function PerpsEmptyData() {
  const intl = useIntl();
  const { copyUrl } = useClipboard();
  const { referralQrCodeUrl } = useReferralUrl();

  const handleCopyLink = useCallback(() => {
    copyUrl(referralQrCodeUrl);
  }, [copyUrl, referralQrCodeUrl]);

  return (
    <YStack ai="center">
      <Empty
        mt="$-10"
        illustration="ShakeHands"
        title={intl.formatMessage({
          id: ETranslations.referral_referred_empty,
        })}
        description={intl.formatMessage({
          id: ETranslations.referral_referred_empty_desc,
        })}
      />
      <Button variant="primary" onPress={handleCopyLink}>
        {intl.formatMessage({ id: ETranslations.browser_copy_link })}
      </Button>
    </YStack>
  );
}
