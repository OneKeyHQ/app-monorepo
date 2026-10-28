import type { ComponentProps, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Popover, useMedia } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ACTIVITY_HUB_PANEL_WIDTH,
  getActivityHubTitleId,
  shouldShowActivityHubInvitePanel,
} from './layout';

import type {
  IActivityHubCampaign,
  IActivityHubOpenReferral,
  IActivityHubSource,
} from './types';

const LazyActivityHubContent = LazyLoad(async () => {
  const { ActivityHubContent } = await import('./ActivityHubContent');
  return { default: ActivityHubContent };
});

export function ActivityHubAction({
  source,
  size = 'medium',
  onOpenReferral,
  campaigns,
  renderTrigger,
  open,
  onOpenChange,
  testID = 'header-gift-action',
  triggerProps,
}: {
  source: IActivityHubSource;
  size?: IButtonProps['size'];
  onOpenReferral: IActivityHubOpenReferral;
  campaigns?: IActivityHubCampaign[];
  renderTrigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  testID?: string;
  triggerProps?: Omit<
    ComponentProps<typeof HeaderIconButton>,
    'icon' | 'title' | 'onPress'
  >;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const hasCampaigns = Boolean(campaigns?.length);
  const hubTitle = intl.formatMessage({
    id: getActivityHubTitleId({
      hasCampaigns,
      showInvitePanel: shouldShowActivityHubInvitePanel(),
    }),
  });
  // The gift's tooltip names where it leads: the referral page, or the
  // activity hub once there are campaigns.
  const triggerTitle = intl.formatMessage({
    id: hasCampaigns
      ? ETranslations.perps_activity_hub
      : ETranslations.sidebar_refer_a_friend,
  });
  // Native popovers always Adapt to a Sheet, so floatingPanelProps.width is a
  // no-op there.
  const isDesktopFloatingPanel = gtMd && !platformEnv.isNative;

  const giftButtonProps = {
    title: triggerTitle,
    icon: 'GiftOutline',
    size,
    testID,
    ...triggerProps,
  } as const;

  // A native hub without campaigns would hold only the referral entry, so the
  // gift opens the referral page itself instead of a one-item sheet. Pointer
  // layouts keep the popover: it holds the code and link to copy.
  if (!shouldShowActivityHubInvitePanel() && !hasCampaigns && !renderTrigger) {
    return (
      <HeaderIconButton
        {...giftButtonProps}
        onPress={() => {
          defaultLogger.referral.activityHub.activityHubActionPressed({
            source,
            action: 'open_referral',
          });
          onOpenReferral();
        }}
      />
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      title={hubTitle}
      showHeader={!gtMd}
      placement="bottom-end"
      floatingPanelProps={{
        width: isDesktopFloatingPanel ? ACTIVITY_HUB_PANEL_WIDTH : undefined,
      }}
      sheetProps={
        gtMd
          ? undefined
          : {
              dismissOnSnapToBottom: true,
            }
      }
      renderTrigger={renderTrigger ?? <HeaderIconButton {...giftButtonProps} />}
      renderContent={({ closePopover }) => (
        <LazyActivityHubContent
          source={source}
          closePopover={closePopover}
          onOpenReferral={onOpenReferral}
          campaigns={campaigns}
        />
      )}
    />
  );
}
