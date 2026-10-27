import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import type { IButtonProps } from '@onekeyhq/components';
import {
  ActivityHubAction,
  ActivityHubContent,
  useShowActivityHub,
} from '@onekeyhq/kit/src/components/ActivityHub';
import { useOpenReferralPage } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { usePerpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpsCampaignIllustration } from './PerpsCampaignIllustration';

function usePerpsActivityHubProps() {
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const campaigns = useMemo(
    () => perpConfigCommon?.activityCards ?? [],
    [perpConfigCommon?.activityCards],
  );

  const handleOpenReferral = useOpenReferralPage();

  return { campaigns, handleOpenReferral };
}

export function PerpsActivityCenterContent({
  closePopover,
  showTitle = true,
  menuLayout = false,
  menuPopoverLayout = false,
}: {
  closePopover: () => void;
  showTitle?: boolean;
  menuLayout?: boolean;
  menuPopoverLayout?: boolean;
}) {
  const { campaigns, handleOpenReferral } = usePerpsActivityHubProps();
  const showActivityHub = useShowActivityHub();
  // The menu already lists the campaigns, so the dialog holds only the
  // invite panel.
  const openInvitePanel = useCallback(() => {
    showActivityHub({ source: 'Perps', onOpenReferral: handleOpenReferral });
  }, [handleOpenReferral, showActivityHub]);

  return (
    <ActivityHubContent
      source="Perps"
      closePopover={closePopover}
      showTitle={showTitle}
      menuLayout={menuLayout}
      menuPopoverLayout={menuPopoverLayout}
      campaignFallbackIllustration={
        menuLayout ? <PerpsCampaignIllustration trimmed /> : undefined
      }
      onOpenReferral={handleOpenReferral}
      onOpenInvitePanel={
        menuLayout && !platformEnv.isNative ? openInvitePanel : undefined
      }
      campaigns={campaigns}
    />
  );
}

export function PerpsActivityCenterAction({
  size = 'medium',
  renderTrigger,
  open,
  onOpenChange,
}: {
  size?: IButtonProps['size'];
  renderTrigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { campaigns, handleOpenReferral } = usePerpsActivityHubProps();

  return (
    <ActivityHubAction
      source="Perps"
      size={size}
      renderTrigger={renderTrigger}
      open={open}
      onOpenChange={onOpenChange}
      onOpenReferral={handleOpenReferral}
      campaigns={campaigns}
    />
  );
}
