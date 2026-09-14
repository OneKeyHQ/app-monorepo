import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import type { IButtonProps } from '@onekeyhq/components';
import {
  ActivityHubAction,
  ActivityHubContent,
} from '@onekeyhq/kit/src/components/ActivityHub';
import { usePerpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useShowInviteeRewardModal } from './InviteeReward/hooks/useShowInviteeRewardModal';

function usePerpsActivityHubProps() {
  const { showInviteeRewardModal } = useShowInviteeRewardModal();
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const campaigns = useMemo(
    () => perpConfigCommon?.activityCards ?? [],
    [perpConfigCommon?.activityCards],
  );

  const handleOpenInviteeReward = useCallback(() => {
    void showInviteeRewardModal();
  }, [showInviteeRewardModal]);

  return { campaigns, handleOpenInviteeReward };
}

export function PerpsActivityCenterContent({
  copyAsUrl = false,
  closePopover,
  showTitle = true,
}: {
  copyAsUrl?: boolean;
  closePopover: () => void;
  showTitle?: boolean;
}) {
  const { campaigns, handleOpenInviteeReward } = usePerpsActivityHubProps();

  return (
    <ActivityHubContent
      source="Perps"
      copyAsUrl={copyAsUrl}
      closePopover={closePopover}
      showTitle={showTitle}
      onOpenInviteeReward={handleOpenInviteeReward}
      campaigns={campaigns}
    />
  );
}

export function PerpsActivityCenterAction({
  size = 'medium',
  copyAsUrl = false,
  renderTrigger,
  open,
  onOpenChange,
}: {
  size?: IButtonProps['size'];
  copyAsUrl?: boolean;
  renderTrigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { campaigns, handleOpenInviteeReward } = usePerpsActivityHubProps();

  return (
    <ActivityHubAction
      source="Perps"
      size={size}
      copyAsUrl={copyAsUrl}
      renderTrigger={renderTrigger}
      open={open}
      onOpenChange={onOpenChange}
      onOpenInviteeReward={handleOpenInviteeReward}
      campaigns={campaigns}
    />
  );
}
