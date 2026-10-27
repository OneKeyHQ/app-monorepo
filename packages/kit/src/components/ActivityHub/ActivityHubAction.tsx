import type { ComponentProps, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Popover, useMedia } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ACTIVITY_HUB_PANEL_WIDTH } from './layout';

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
  const activityCenterTitle = intl.formatMessage({
    id: ETranslations.perps_activity_hub,
  });
  const hasCampaigns = Boolean(campaigns?.length);
  // Native popovers always Adapt to a Sheet, so floatingPanelProps.width is a
  // no-op there.
  const isDesktopFloatingPanel = gtMd && !platformEnv.isNative;

  // A native hub without campaigns would hold only the referral entry, so the
  // gift opens the referral page itself instead of a one-item sheet. Pointer
  // layouts keep the popover: it holds the code and link to copy.
  if (platformEnv.isNative && !hasCampaigns && !renderTrigger) {
    return (
      <HeaderIconButton
        title={intl.formatMessage({ id: ETranslations.sidebar_refer_a_friend })}
        icon="GiftOutline"
        size={size}
        testID={testID}
        {...triggerProps}
        onPress={() => onOpenReferral()}
      />
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      title={activityCenterTitle}
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
          closePopover={closePopover}
          onOpenReferral={onOpenReferral}
          campaigns={campaigns}
        />
      )}
    />
  );
}
