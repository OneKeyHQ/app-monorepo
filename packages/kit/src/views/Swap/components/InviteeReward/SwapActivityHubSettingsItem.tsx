import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useDialogInstance } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SwapTestIDs } from '../../testIDs';

export function SwapActivityHubSettingsItem({
  onOpenReferral,
}: {
  onOpenReferral: () => void;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  // Swap has no campaigns, so the hub would hold only the referral entry;
  // the item opens the referral page directly.
  const title = intl.formatMessage({ id: ETranslations.sidebar_refer_a_friend });

  const handlePress = useCallback(async () => {
    // Swap settings is itself a dialog/sheet, so it has to finish closing
    // before the referral page opens.
    await dialog.close();
    onOpenReferral();
  }, [dialog, onOpenReferral]);

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
