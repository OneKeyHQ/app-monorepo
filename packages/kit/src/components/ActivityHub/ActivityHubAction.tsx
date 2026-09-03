import type { ComponentProps, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Popover, useMedia } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getActivityHubLayout } from './layout';

import type { IActivityHubCampaign, IActivityHubSource } from './types';

const LazyActivityHubContent = LazyLoad(async () => {
  const { ActivityHubContent } = await import('./ActivityHubContent');
  return { default: ActivityHubContent };
});

export function ActivityHubAction({
  source,
  size = 'medium',
  copyAsUrl = false,
  onOpenInviteeReward,
  campaigns,
  renderTrigger,
  open,
  onOpenChange,
  testID = 'header-gift-action',
  triggerProps,
}: {
  source: IActivityHubSource;
  size?: IButtonProps['size'];
  copyAsUrl?: boolean;
  onOpenInviteeReward: () => void;
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
  const activityCenterTitle = intl.formatMessage({
    id: ETranslations.perps_activity_hub,
  });
  const hasCampaigns = Boolean(campaigns?.length);
  // Native popovers always Adapt to a Sheet, so floatingPanelProps.width is a
  // no-op there. Compact tiles belong only to the desktop 208px floating panel.
  const isDesktopFloatingPanel = gtMd && !platformEnv.isNative;
  const isCompactPanel = isDesktopFloatingPanel && !hasCampaigns;
  const { panelWidth } = getActivityHubLayout(hasCampaigns);

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      title={activityCenterTitle}
      showHeader={!gtMd}
      placement="bottom-end"
      floatingPanelProps={{
        width: isDesktopFloatingPanel ? panelWidth : undefined,
      }}
      sheetProps={
        gtMd
          ? undefined
          : {
              dismissOnSnapToBottom: true,
            }
      }
      renderTrigger={
        renderTrigger ?? (
          <HeaderIconButton
            title={activityCenterTitle}
            icon="GiftOutline"
            size={size}
            testID={testID}
            {...triggerProps}
          />
        )
      }
      renderContent={({ closePopover }) => (
        <LazyActivityHubContent
          source={source}
          copyAsUrl={copyAsUrl}
          closePopover={closePopover}
          isCompactPanel={isCompactPanel}
          onOpenInviteeReward={onOpenInviteeReward}
          campaigns={campaigns}
        />
      )}
    />
  );
}
