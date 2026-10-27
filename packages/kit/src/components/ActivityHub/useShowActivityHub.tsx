import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useDialogInstance, useMedia } from '@onekeyhq/components';

import { ActivityHubContent } from './ActivityHubContent';
import { ACTIVITY_HUB_PANEL_WIDTH, getActivityHubTitleId } from './layout';

import type {
  IActivityHubCampaign,
  IActivityHubOpenReferral,
  IActivityHubSource,
} from './types';

type IShowActivityHubParams = {
  source: IActivityHubSource;
  onOpenReferral: IActivityHubOpenReferral;
  campaigns?: IActivityHubCampaign[];
};

function ActivityHubDialogContent({
  source,
  onOpenReferral,
  campaigns,
}: IShowActivityHubParams) {
  const dialog = useDialogInstance();

  return (
    <ActivityHubContent
      source={source}
      showTitle={false}
      closePopover={() => dialog.close()}
      onOpenReferral={onOpenReferral}
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
      // Unlike Popover, Dialog only degrades to a sheet below the md
      // breakpoint. Above it every platform (native tablets included) renders a
      // floating panel that honours floatingPanelProps.
      Dialog.show({
        // Only pointer layouts open the hub as a dialog, so it holds the
        // invite panel.
        title: intl.formatMessage({
          id: getActivityHubTitleId({
            hasCampaigns: Boolean(params.campaigns?.length),
            showInvitePanel: true,
          }),
        }),
        floatingPanelProps: gtMd
          ? {
              width: ACTIVITY_HUB_PANEL_WIDTH,
            }
          : undefined,
        showFooter: false,
        // The hub content brings the popover's own padding.
        contentContainerProps: {
          px: '$0',
          pb: '$0',
        },
        renderContent: <ActivityHubDialogContent {...params} />,
      });
    },
    [gtMd, intl],
  );
}
