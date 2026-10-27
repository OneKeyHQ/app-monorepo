import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useDialogInstance } from '@onekeyhq/components';
import { useShowActivityHub } from '@onekeyhq/kit/src/components/ActivityHub';
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
  const showActivityHub = useShowActivityHub();
  const title = intl.formatMessage({ id: ETranslations.perps_activity_hub });

  const handlePress = useCallback(async () => {
    // Swap settings is itself a dialog/sheet, so it has to finish closing before
    // the hub opens on top of it.
    await dialog.close();
    showActivityHub({
      source: 'Swap',
      onOpenReferral,
    });
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
