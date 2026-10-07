import { useCallback, useEffect, useRef } from 'react';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useFetchWalletsWithBoundStatus,
  useWalletBoundReferralCode,
} from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

import { getInviteBindRowKind } from './getInviteBindRowKind';

export function InviteBindRow() {
  const { walletsWithStatus, refreshWalletsWithStatus } =
    useFetchWalletsWithBoundStatus();
  const { bindWalletInviteCode } = useWalletBoundReferralCode({
    entry: platformEnv.isNative ? 'modal' : 'tab',
  });
  const kind = getInviteBindRowKind(walletsWithStatus);
  const isBound = kind === 'bound';
  const hasLoggedShownRef = useRef(false);

  useEffect(() => {
    if (kind === 'unknown' || hasLoggedShownRef.current) {
      return;
    }
    hasLoggedShownRef.current = true;
    defaultLogger.referral.page.inviteBindRowShown({ status: kind });
  }, [kind]);

  const handlePress = useCallback(() => {
    bindWalletInviteCode({
      source: 'invite_home',
      onSuccess: () => {
        void refreshWalletsWithStatus();
      },
    });
  }, [bindWalletInviteCode, refreshWalletsWithStatus]);

  return (
    <ListItem
      testID={ReferFriendsTestIDs.inviteBindRow}
      mx="$0"
      px="$0"
      drillIn={!isBound}
      onPress={isBound ? undefined : handlePress}
    >
      <XStack p="$2" borderRadius="$3" bg="$bgSubdued">
        <Icon name="GiftOutline" size="$6" color="$icon" />
      </XStack>
      <YStack flex={1} gap="$0.5">
        <SizableText size="$bodyLgMedium">
          {isBound ? INVITE_COPY.boundTitle : INVITE_COPY.bindTitle}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {isBound ? INVITE_COPY.boundDescription : INVITE_COPY.bindDescription}
        </SizableText>
      </YStack>
    </ListItem>
  );
}
