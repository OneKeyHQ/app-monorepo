import type { IButtonProps } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ActivityHubAction } from '@onekeyhq/kit/src/components/ActivityHub/ActivityHubAction';
import { useOpenReferralPage } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function EarnActivityHubAction({
  size = 'medium',
}: {
  size?: IButtonProps['size'];
}) {
  const isTravelMode =
    travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
    'travel-mode';
  const handleOpenReferral = useOpenReferralPage();

  return (
    <ActivityHubAction
      source="Earn"
      size={size}
      open={isTravelMode ? false : undefined}
      triggerProps={{ disabled: isTravelMode }}
      onOpenReferral={handleOpenReferral}
    />
  );
}

export function GiftAction({
  size = 'medium',
}: {
  size?: IButtonProps['size'];
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnActivityHubAction size={size} />
    </AccountSelectorProviderMirror>
  );
}
