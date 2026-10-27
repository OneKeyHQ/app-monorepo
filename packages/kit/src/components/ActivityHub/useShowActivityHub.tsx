import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useDialogInstance, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ActivityHubContent } from './ActivityHubContent';
import { ACTIVITY_HUB_PANEL_WIDTH } from './layout';

import type { IActivityHubOpenReferral, IActivityHubSource } from './types';

type IShowActivityHubParams = {
  source: IActivityHubSource;
  onOpenReferral: IActivityHubOpenReferral;
};

function ActivityHubDialogContent({
  source,
  onOpenReferral,
}: IShowActivityHubParams) {
  const dialog = useDialogInstance();

  return (
    <ActivityHubContent
      source={source}
      showTitle={false}
      closePopover={() => dialog.close()}
      onOpenReferral={onOpenReferral}
    />
  );
}

// Pointer-layout surfaces that cannot host the gift popover (the Swap settings
// sheet, the Perps menu) open the invite panel as a dialog instead. Their
// campaigns, if any, are listed where they are opened from.
export function useShowActivityHub() {
  const intl = useIntl();
  const { gtMd } = useMedia();

  return useCallback(
    (params: IShowActivityHubParams) => {
      // Dialog degrades to a sheet below the md breakpoint; above it, a
      // floating panel that honours floatingPanelProps.
      Dialog.show({
        title: intl.formatMessage({ id: ETranslations.referral_home__title }),
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
