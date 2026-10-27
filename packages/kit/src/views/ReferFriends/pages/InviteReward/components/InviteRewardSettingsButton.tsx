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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { InviteProfilePublicSwitch } from './InviteProfilePublicSwitch';

export function InviteRewardSettingsButton() {
  const intl = useIntl();
  const { md } = useMedia();
  const label = intl.formatMessage({ id: ETranslations.global_settings });
  const renderContent = useCallback(
    () => (
      <YStack px="$4" py="$3.5">
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
          title={label}
        />
      );
    }
    return (
      <Button
        testID={ReferFriendsTestIDs.inviteRewardSettingsBtn}
        variant="tertiary"
        size={platformEnv.isWeb ? 'small' : undefined}
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
      floatingPanelProps={{
        width: 320,
      }}
    />
  );
}
