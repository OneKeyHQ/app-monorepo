import { useCallback } from 'react';

import type { IButtonProps } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ActivityHubAction } from '@onekeyhq/kit/src/components/ActivityHub/ActivityHubAction';
import { useShowEarnInviteeReward } from '@onekeyhq/kit/src/views/Earn/components/InviteeReward/hooks/useShowEarnInviteeReward';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function EarnActivityHubAction({
  size = 'medium',
  copyAsUrl = false,
}: {
  size?: IButtonProps['size'];
  copyAsUrl?: boolean;
}) {
  const { showEarnInviteeReward } = useShowEarnInviteeReward();
  const handleOpenInviteeReward = useCallback(() => {
    showEarnInviteeReward();
  }, [showEarnInviteeReward]);

  return (
    <ActivityHubAction
      source="Earn"
      size={size}
      copyAsUrl={copyAsUrl}
      onOpenInviteeReward={handleOpenInviteeReward}
    />
  );
}

export function GiftAction({
  size = 'medium',
  copyAsUrl = false,
}: {
  size?: IButtonProps['size'];
  copyAsUrl?: boolean;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnActivityHubAction size={size} copyAsUrl={copyAsUrl} />
    </AccountSelectorProviderMirror>
  );
}
