import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useDialogInstance } from '@onekeyhq/components';
import { useShowActivityHub } from '@onekeyhq/kit/src/components/ActivityHub';
import type { IActivityHubOpenReferral } from '@onekeyhq/kit/src/components/ActivityHub';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SwapTestIDs } from '../../testIDs';

export function SwapActivityHubSettingsItem({
  onOpenReferral,
}: {
  onOpenReferral: IActivityHubOpenReferral;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const showActivityHub = useShowActivityHub();
  // Swap has no campaigns. Native has no Referral tab, so the item is the way
  // to the referral page; elsewhere it opens the hub with the code to copy.
  const opensReferralPage = platformEnv.isNative;
  const title = intl.formatMessage({
    id: ETranslations.sidebar_refer_a_friend,
  });

  const handlePress = useCallback(async () => {
    // Swap settings is itself a dialog/sheet, so it has to finish closing
    // before anything opens on top of it.
    await dialog.close();
    if (opensReferralPage) {
      defaultLogger.referral.activityHub.activityHubActionPressed({
        source: 'Swap',
        action: 'open_referral',
      });
      onOpenReferral();
      return;
    }
    showActivityHub({ source: 'Swap', onOpenReferral });
  }, [dialog, onOpenReferral, opensReferralPage, showActivityHub]);

  return (
    <ListItem
      testID={SwapTestIDs.activityHubSettingsItem}
      bg="transparent"
      hoverStyle={{ bg: 'transparent' }}
      pressStyle={{ bg: 'transparent' }}
      mx="$0"
      px="$0"
      py="$0"
      minHeight="$9"
      title={title}
      titleProps={{ size: '$bodyLgMedium' }}
      drillIn
      onPress={handlePress}
      nativePressableStyle={{ flexShrink: 0 }}
      cursor="default"
    />
  );
}
