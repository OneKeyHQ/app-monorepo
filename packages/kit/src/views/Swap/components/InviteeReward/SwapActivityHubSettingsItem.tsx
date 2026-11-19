import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useDialogInstance } from '@onekeyhq/components';
import {
  shouldShowActivityHubInvitePanel,
  useShowActivityHub,
} from '@onekeyhq/kit/src/components/ActivityHub';
import type { IActivityHubOpenReferral } from '@onekeyhq/kit/src/components/ActivityHub';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { SwapTestIDs } from '../../testIDs';

export function SwapActivityHubSettingsItem({
  onOpenReferral,
}: {
  onOpenReferral: IActivityHubOpenReferral;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const showActivityHub = useShowActivityHub();
  const title = intl.formatMessage({
    id: ETranslations.sidebar_refer_a_friend,
  });

  const handlePress = useCallback(async () => {
    // Swap settings is itself a dialog/sheet, so it has to finish closing
    // before anything opens on top of it.
    await dialog.close();
    // Swap has no campaigns, so the item opens the invite panel or, where the
    // hub skips it, the referral page.
    if (!shouldShowActivityHubInvitePanel()) {
      defaultLogger.referral.activityHub.activityHubActionPressed({
        source: 'Swap',
        action: 'open_referral',
      });
      onOpenReferral();
      return;
    }
    showActivityHub({ source: 'Swap', onOpenReferral });
  }, [dialog, onOpenReferral, showActivityHub]);

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
