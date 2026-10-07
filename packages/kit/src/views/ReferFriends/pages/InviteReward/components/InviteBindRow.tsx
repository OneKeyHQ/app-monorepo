import { useCallback, useEffect, useRef } from 'react';

import { Button, SizableText, XStack } from '@onekeyhq/components';
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

  // A secondary entry: one quiet line on every layout, so it does not
  // compete with the invite actions above it. It wraps on narrow screens.
  return (
    <XStack ai="center" gap="$1.5" flexWrap="wrap">
      <SizableText size="$bodyMd" color="$textSubdued">
        {isBound ? INVITE_COPY.boundTitle : INVITE_COPY.bindTitle}
      </SizableText>
      {isBound ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {`· ${INVITE_COPY.boundDescription}`}
        </SizableText>
      ) : (
        <Button
          testID={ReferFriendsTestIDs.inviteBindRow}
          variant="tertiary"
          size="small"
          // The question stays subdued; the action reads as the action.
          color="$text"
          iconAfter="ChevronRightSmallOutline"
          onPress={handlePress}
        >
          {INVITE_COPY.bindDescription}
        </Button>
      )}
    </XStack>
  );
}
