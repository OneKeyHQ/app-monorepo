import type { ComponentProps } from 'react';

import { ActivityHubAction } from '@onekeyhq/kit/src/components/ActivityHub';
import { useOpenReferralPage } from '@onekeyhq/kit/src/hooks/useReferFriends';

export function SwapActivityHubHeaderAction({
  testID = 'swap-invitee-reward-top-nav-button',
  ...rest
}: Omit<
  ComponentProps<typeof ActivityHubAction>,
  'source' | 'onOpenReferral'
>) {
  const openReferralPage = useOpenReferralPage();

  return (
    <ActivityHubAction
      source="Swap"
      testID={testID}
      onOpenReferral={openReferralPage}
      {...rest}
    />
  );
}
