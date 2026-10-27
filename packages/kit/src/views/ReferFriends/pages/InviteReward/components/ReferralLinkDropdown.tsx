import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Popover, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { InviteProfilePublicSwitch } from './InviteProfilePublicSwitch';
import {
  REFERRAL_LINK_POPOVER_WIDTH,
  ReferralLinkPopoverContent,
} from './shared';

interface IReferralLinkDropdownProps {
  inviteUrl: string;
}

export function ReferralLinkDropdown({
  inviteUrl,
}: IReferralLinkDropdownProps) {
  const intl = useIntl();

  const handleStopPropagation = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
    },
    [],
  );

  // Whether the invite pages show the user's nickname and avatar sits with
  // the pages it affects, rather than behind a page-level settings button.
  const renderContent = useCallback(
    () => (
      <ReferralLinkPopoverContent
        inviteUrl={inviteUrl}
        footer={<InviteProfilePublicSwitch />}
      />
    ),
    [inviteUrl],
  );

  const renderTrigger = useMemo(
    () => (
      <IconButton
        testID="refer-friends-render-trigger-icon-btn"
        icon="ChevronDownSmallOutline"
        variant="tertiary"
        size="small"
      />
    ),
    [],
  );

  return (
    <Stack onPress={handleStopPropagation}>
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_more_links })}
        description={intl.formatMessage({
          id: ETranslations.referral_morelink_description,
        })}
        renderTrigger={renderTrigger}
        renderContent={renderContent}
        floatingPanelProps={{
          width: REFERRAL_LINK_POPOVER_WIDTH,
        }}
      />
    </Stack>
  );
}
