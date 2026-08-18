import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useDialogInstance } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
}: IShowActivityHubParams) {
  const dialog = useDialogInstance();

  return (
    <ActivityHubContent
      source={source}
      copyAsUrl={copyAsUrl}
      showTitle={false}
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

  return useCallback(
    (params: IShowActivityHubParams) => {
      const { panelWidth } = getActivityHubLayout(
        Boolean(params.campaigns?.length),
      );
      Dialog.show({
        title: intl.formatMessage({ id: ETranslations.perps_activity_hub }),
        floatingPanelProps: {
          width: panelWidth,
        },
        showFooter: false,
        // The hub content brings the popover's own padding.
        contentContainerProps: {
          px: '$0',
          pb: '$0',
        },
        renderContent: <ActivityHubDialogContent {...params} />,
      });
    },
    [intl],
  );
}
