import { useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import type { IButtonProps } from '@onekeyhq/components';
import {
  ActivityHubAction,
  ActivityHubContent,
  shouldShowActivityHubInvitePanel,
  useShowActivityHub,
} from '@onekeyhq/kit/src/components/ActivityHub';
import type { IActivityHubOpenReferral } from '@onekeyhq/kit/src/components/ActivityHub';
import { useOpenReferralPage } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { usePerpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { PerpsCampaignIllustration } from './PerpsCampaignIllustration';

function usePerpsActivityCampaigns() {
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  return useMemo(
    () => perpConfigCommon?.activityCards ?? [],
    [perpConfigCommon?.activityCards],
  );
}

// The shared header loads this only for Perps, and the opener outlives the menu.
export function PerpsReferralEntry({
  children,
}: {
  children: (openReferralPage: IActivityHubOpenReferral) => ReactNode;
}) {
  const openReferralPage = useOpenReferralPage();
  const openReferralPageRef = useRef(openReferralPage);
  openReferralPageRef.current = openReferralPage;
  // RawPopover uses the content callback as a component type. Theme changes
  // must update the opener without remounting the account panel's subpage.
  const handleOpenReferral = useCallback<IActivityHubOpenReferral>(
    (...args) => openReferralPageRef.current(...args),
    [],
  );
  return children(handleOpenReferral);
}

export function PerpsActivityCenterContent({
  closePopover,
  showTitle = true,
  menuLayout = false,
  menuPopoverLayout = false,
  menuShortcuts,
  renderMenuReferral,
  onOpenReferral,
}: {
  closePopover: () => void;
  showTitle?: boolean;
  menuLayout?: boolean;
  menuPopoverLayout?: boolean;
  menuShortcuts?: ReactNode;
  renderMenuReferral?: (referral: ReactNode) => ReactNode;
  // Must come from a component that outlives this menu: the menu closes
  // before the referral page opens, and the referral entry cancels itself
  // when its owner unmounts.
  onOpenReferral: IActivityHubOpenReferral;
}) {
  const campaigns = usePerpsActivityCampaigns();
  const showActivityHub = useShowActivityHub();
  // The menu already lists the campaigns, so the dialog holds only the
  // invite panel.
  const openInvitePanel = useCallback(() => {
    showActivityHub({ source: 'Perps', onOpenReferral });
  }, [onOpenReferral, showActivityHub]);

  return (
    <ActivityHubContent
      source="Perps"
      closePopover={closePopover}
      showTitle={showTitle}
      menuLayout={menuLayout}
      menuPopoverLayout={menuPopoverLayout}
      menuShortcuts={menuShortcuts}
      renderMenuReferral={renderMenuReferral}
      campaignFallbackIllustration={
        menuLayout ? <PerpsCampaignIllustration trimmed /> : undefined
      }
      onOpenReferral={onOpenReferral}
      onOpenInvitePanel={
        menuLayout && shouldShowActivityHubInvitePanel()
          ? openInvitePanel
          : undefined
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
  const campaigns = usePerpsActivityCampaigns();
  const handleOpenReferral = useOpenReferralPage();

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
