import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useDialogInstance, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ActivityHubContent } from './ActivityHubContent';
import { getActivityHubLayout } from './layout';

import type { IActivityHubCampaign, IActivityHubSource } from './types';

type IShowActivityHubParams = {
  source: IActivityHubSource;
  copyAsUrl?: boolean;
  onOpenInviteeReward: () => void;
  campaigns?: IActivityHubCampaign[];
};

function ActivityHubDialogContent({
  source,
  copyAsUrl,
  onOpenInviteeReward,
  campaigns,
  isCompactPanel,
}: IShowActivityHubParams & { isCompactPanel: boolean }) {
  const dialog = useDialogInstance();

  return (
    <ActivityHubContent
      source={source}
      copyAsUrl={copyAsUrl}
      showTitle={false}
      isCompactPanel={isCompactPanel}
      closePopover={() => dialog.close()}
      onOpenInviteeReward={onOpenInviteeReward}
      campaigns={campaigns}
    />
  );
}

// Surfaces that cannot host the gift popover (the Swap settings sheet) open the
// same hub content as a dialog instead.
export function useShowActivityHub() {
  const intl = useIntl();
  const { gtMd } = useMedia();

  return useCallback(
    (params: IShowActivityHubParams) => {
      const hasCampaigns = Boolean(params.campaigns?.length);
      const isDesktopFloatingPanel = gtMd && !platformEnv.isNative;
      const isCompactPanel = isDesktopFloatingPanel && !hasCampaigns;
      const { panelWidth } = getActivityHubLayout(hasCampaigns);
      Dialog.show({
        title: intl.formatMessage({ id: ETranslations.perps_activity_hub }),
        floatingPanelProps: isDesktopFloatingPanel
          ? {
              width: panelWidth,
            }
          : undefined,
        showFooter: false,
        // The hub content brings the popover's own padding.
        contentContainerProps: {
          px: '$0',
          pb: '$0',
        },
        renderContent: (
          <ActivityHubDialogContent
            {...params}
            isCompactPanel={isCompactPanel}
          />
        ),
      });
    },
    [gtMd, intl],
  );
}
