import type { ComponentProps, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Popover, useMedia } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ActivityHubContent } from './ActivityHubContent';

import type { IActivityHubCampaign, IActivityHubSource } from './types';

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

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      title={activityCenterTitle}
      showHeader={!gtMd}
      placement="bottom-end"
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
        <ActivityHubContent
          source={source}
          copyAsUrl={copyAsUrl}
          closePopover={closePopover}
          onOpenInviteeReward={onOpenInviteeReward}
          campaigns={campaigns}
        />
      )}
    />
  );
}
