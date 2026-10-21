import type { ComponentProps } from 'react';

import { ActivityHubAction } from '@onekeyhq/kit/src/components/ActivityHub';
import { useOpenPerksTab } from '@onekeyhq/kit/src/hooks/useReferFriends';

export function SwapActivityHubHeaderAction({
  testID = 'swap-invitee-reward-top-nav-button',
  ...rest
}: Omit<
  ComponentProps<typeof ActivityHubAction>,
  'source' | 'onOpenInviteeReward' | 'copyAsUrl'
>) {
  const openPerksTab = useOpenPerksTab();

  return (
    <ActivityHubAction
      source="Swap"
      copyAsUrl
      testID={testID}
      onOpenInviteeReward={openPerksTab}
      {...rest}
    />
  );
}
