import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useDialogInstance, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ActivityHubContent } from './ActivityHubContent';
import { ACTIVITY_HUB_PANEL_WIDTH } from './layout';

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
        title: intl.formatMessage({ id: ETranslations.perps_activity_hub }),
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
