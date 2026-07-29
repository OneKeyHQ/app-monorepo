import { useCallback } from 'react';

import {
  Icon,
  SizableText,
  XStack,
  useDialogInstance,
} from '@onekeyhq/components';

import { SwapTestIDs } from '../../testIDs';

import { useSwapInviteeRewardAction } from './SwapInviteeRewardActionButton';

export function SwapInviteeRewardSettingsItem() {
  const dialog = useDialogInstance();
  const { showSwapInviteeReward, title } = useSwapInviteeRewardAction();
  const handlePress = useCallback(async () => {
    await dialog.close();
    showSwapInviteeReward();
  }, [dialog, showSwapInviteeReward]);

  return (
    <XStack
      testID={SwapTestIDs.inviteeRewardSettingsItem}
      minHeight="$9"
      alignItems="center"
      justifyContent="space-between"
      onPress={handlePress}
      cursor="default"
    >
      <XStack alignItems="center" gap="$3">
        <Icon name="GiftOutline" size="$5" color="$iconSubdued" />
        <SizableText size="$bodyMdMedium">{title}</SizableText>
      </XStack>
      <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}
