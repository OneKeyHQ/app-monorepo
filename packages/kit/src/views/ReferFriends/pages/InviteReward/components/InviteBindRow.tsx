import { useCallback, useEffect, useRef } from 'react';

import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';
import {
  useFetchWalletsWithBoundStatus,
  useWalletBoundReferralCode,
} from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

import { getInviteBindRowKind } from './getInviteBindRowKind';
import {
  PRESSABLE_SURFACE_PROPS,
  useInviteHomeCardStyle,
} from './useInviteCardStyle';

export function InviteBindRow({
  variant = 'inline',
}: {
  // `card`: a standalone compact row shown only until a code is linked.
  variant?: 'inline' | 'card';
} = {}) {
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

  const cardStyle = useInviteHomeCardStyle();

  // Unknown covers loading, a failed status check and wallets whose bind
  // window has closed: none has an action to offer, and showing the prompt
  // would flash or open a dialog with Apply disabled.
  if (kind === 'unknown') {
    return null;
  }

  if (variant === 'card') {
    // Linked users have nothing to do here, so the card disappears.
    if (isBound) {
      return null;
    }
    return (
      <XStack
        ai="center"
        gap="$3"
        px="$4"
        // Same 16px text inset (and 52px height) as a one-row entries card.
        py="$4"
        {...cardStyle}
        {...PRESSABLE_SURFACE_PROPS}
        testID={ReferFriendsTestIDs.inviteBindRow}
        onPress={handlePress}
      >
        <SizableText flex={1} size="$bodyMd" color="$textSubdued">
          {INVITE_COPY.bindTitle}
        </SizableText>
        <SizableText size="$bodyMdMedium">
          {INVITE_COPY.bindDescription}
        </SizableText>
        {/* Same size and edge as the list drill-in chevrons. */}
        <Icon name="ChevronRightSmallOutline" color="$iconSubdued" mx="$-1.5" />
      </XStack>
    );
  }

  // A secondary entry: one quiet line, so it does not compete with the
  // invite actions above it. It wraps on narrow screens.
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
