import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  SizableText,
  Switch,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ReferFriendsTestIDs } from '@onekeyhq/kit/src/views/ReferFriends/testIDs';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

export function InviteProfilePublicSwitch() {
  const intl = useIntl();
  const [user] = usePrimePersistAtom();
  const [pendingValue, setPendingValue] = useState<boolean | undefined>(
    undefined,
  );
  const value = pendingValue ?? user.inviteProfilePublic === true;

  const handleChange = useCallback(
    async (next: boolean) => {
      setPendingValue(next);
      try {
        const success =
          await backgroundApiProxy.servicePrime.updateInviteProfilePublic({
            enabled: next,
          });
        if (!success) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_update_failed,
            }),
          });
          return;
        }
        defaultLogger.referral.page.toggleInviteProfilePublic(next);
      } catch {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_update_failed,
          }),
        });
      } finally {
        setPendingValue(undefined);
      }
    },
    [intl],
  );

  return (
    <XStack ai="center" jc="space-between" gap="$4">
      <YStack flex={1} gap="$1" maxWidth={240}>
        <SizableText size="$bodyMd" color="$text">
          {intl.formatMessage({
            id: ETranslations.invite_page_show_profile__title,
          })}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.invite_page_show_profile__desc,
          })}
        </SizableText>
      </YStack>
      <Switch
        size={ESwitchSize.small}
        value={value}
        disabled={pendingValue !== undefined}
        testID={ReferFriendsTestIDs.inviteProfilePublicSwitch}
        onChange={(next) => {
          void handleChange(next);
        }}
      />
    </XStack>
  );
}
