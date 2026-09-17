import type { ComponentProps } from 'react';

import { ActivityHubAction } from '@onekeyhq/kit/src/components/ActivityHub';

import { useSwapInviteeRewardAction } from './hooks/useSwapInviteeRewardAction';

export function SwapActivityHubHeaderAction({
  testID = 'swap-invitee-reward-top-nav-button',
  ...rest
}: Omit<
  ComponentProps<typeof ActivityHubAction>,
  'source' | 'onOpenInviteeReward' | 'copyAsUrl'
>) {
  const { showSwapInviteeReward } = useSwapInviteeRewardAction();

  return (
    <ActivityHubAction
      source="Swap"
      copyAsUrl
      testID={testID}
      onOpenInviteeReward={showSwapInviteeReward}
      {...rest}
    />
  );
}
