import { useMemo } from 'react';
import type { ReactNode } from 'react';

import type { IButtonProps } from '@onekeyhq/components';
import {
  ActivityHubAction,
  ActivityHubContent,
} from '@onekeyhq/kit/src/components/ActivityHub';
import { useOpenReferralPage } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { usePerpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

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
