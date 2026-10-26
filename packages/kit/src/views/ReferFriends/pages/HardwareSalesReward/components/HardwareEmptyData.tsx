import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Empty, YStack, useClipboard } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferFriendsTestIDs } from '../../../testIDs';

import { useHardwareShopInviteUrl } from './useHardwareShopInviteUrl';

export function HardwareEmptyData() {
  const intl = useIntl();
  const { copyUrl } = useClipboard();
  const { shopInviteUrl, isReady } = useHardwareShopInviteUrl();

  const handleCopyLink = useCallback(() => {
    if (!shopInviteUrl) {
      return;
    }
    copyUrl(shopInviteUrl);
  }, [copyUrl, shopInviteUrl]);

  return (
    <YStack px="$5" gap="$3" pb="$5">
      <Empty
        illustration="BlockCoins"
        title={intl.formatMessage({
          id: ETranslations.referral_referred_empty,
        })}
        description={intl.formatMessage({
          id: ETranslations.referral_referred_empty_desc,
        })}
        buttonProps={{
          testID: ReferFriendsTestIDs.hardwareEmptyCopyLinkBtn,
          variant: 'primary',
          loading: !isReady,
          disabled: !shopInviteUrl,
          onPress: handleCopyLink,
          children: intl.formatMessage({ id: ETranslations.browser_copy_link }),
        }}
      />
    </YStack>
  );
}
