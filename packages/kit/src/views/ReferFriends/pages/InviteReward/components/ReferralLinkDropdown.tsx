import { useCallback, useMemo } from 'react';

import { IconButton, Popover, Stack } from '@onekeyhq/components';

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
  const handleStopPropagation = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
    },
    [],
  );

  const renderContent = useCallback(
    () => <ReferralLinkPopoverContent inviteUrl={inviteUrl} />,
    [inviteUrl],
  );

  const renderTrigger = useMemo(
    () => (
      <IconButton
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
        title=""
        renderTrigger={renderTrigger}
        renderContent={renderContent}
        floatingPanelProps={{
          width: REFERRAL_LINK_POPOVER_WIDTH,
        }}
      />
    </Stack>
  );
}
