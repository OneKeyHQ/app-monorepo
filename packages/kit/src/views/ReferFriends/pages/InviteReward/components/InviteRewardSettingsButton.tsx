import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  Popover,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ReferFriendsTestIDs } from '@onekeyhq/kit/src/views/ReferFriends/testIDs';
import { NATIVE_MEDIUM_ICON_HIT_SLOP } from '@onekeyhq/kit/src/views/ReferFriends/utils/touchTarget';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { InviteProfilePublicSwitch } from './InviteProfilePublicSwitch';
import { INVITE_POPOVER_PANEL_PROPS } from './useInviteCardStyle';

// Built like the Rules button beside it: an icon button in compact headers,
// a small text button on pointer layouts, and the page's popover panel.
export function InviteRewardSettingsButton() {
  const intl = useIntl();
  const { md } = useMedia();
  const label = intl.formatMessage({ id: ETranslations.global_settings });
  const renderContent = useCallback(
    () => (
      <YStack px="$5" py="$4">
        <InviteProfilePublicSwitch />
      </YStack>
    ),
    [],
  );
  const renderTrigger = useMemo(() => {
    if (md) {
      return (
        <IconButton
          testID={ReferFriendsTestIDs.inviteRewardSettingsBtn}
          variant="tertiary"
          icon="SettingsOutline"
          hitSlop={NATIVE_MEDIUM_ICON_HIT_SLOP}
          title={label}
        />
      );
    }
    return (
      <Button
        testID={ReferFriendsTestIDs.inviteRewardSettingsBtn}
        variant="tertiary"
        size="small"
        icon="SettingsOutline"
      >
        {label}
      </Button>
    );
  }, [label, md]);

  return (
    <Popover
      title={label}
      renderTrigger={renderTrigger}
      renderContent={renderContent}
      placement="bottom-end"
      floatingPanelProps={INVITE_POPOVER_PANEL_PROPS}
    />
  );
}
