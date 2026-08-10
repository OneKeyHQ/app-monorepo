import { useCallback } from 'react';

import { useDialogInstance } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { SwapTestIDs } from '../../testIDs';

export function SwapInviteeRewardSettingsItem({
  onShowSwapInviteeReward,
  title,
}: {
  onShowSwapInviteeReward: () => void;
  title: string;
}) {
  const dialog = useDialogInstance();
  const handlePress = useCallback(async () => {
    await dialog.close();
    onShowSwapInviteeReward();
  }, [dialog, onShowSwapInviteeReward]);

  return (
    <ListItem
      testID={SwapTestIDs.inviteeRewardSettingsItem}
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
