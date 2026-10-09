import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import {
  useFetchWalletsWithBoundStatus,
  useWalletBoundReferralCode,
} from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferFriendsTestIDs } from '../../../testIDs';

import { getInviteBindRowKind } from './getInviteBindRowKind';
import { INVITE_CARD_BORDER_COLOR } from './useInviteCardStyle';

export function InviteBindRow({
  divided = false,
}: {
  // Draws a divider above the line, so it goes away with the line.
  divided?: boolean;
} = {}) {
  const intl = useIntl();
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

  // While the wallet statuses load, a placeholder holds the line's height
  // so the cards around it do not jump when it arrives.
  const isLoading = walletsWithStatus === undefined;
  // Unknown after loading means a failed status check or wallets whose bind
  // window has closed: neither has an action to offer, and the prompt would
  // open a dialog with Apply disabled.
  if (kind === 'unknown' && !isLoading) {
    return null;
  }

  // A secondary entry: one quiet line, so it does not compete with the
  // invite actions above it. It wraps on narrow screens.
  const line = isLoading ? (
    // The line lays out at its text height (the tertiary button's negative
    // margins cancel its padding), so the placeholder matches that.
    <XStack h={20} ai="center">
      <Skeleton.BodyMd w={240} />
    </XStack>
  ) : (
    // A secondary entry: one quiet line, so it does not compete with the
    // invite actions above it. It wraps on narrow screens. Once linked, it
    // only states that.
    <XStack ai="center" gap="$1.5" flexWrap="wrap">
      {isBound ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.referral_code_linked__msg })}
        </SizableText>
      ) : (
        <>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.referral_bind_question__desc,
            })}
          </SizableText>
          <Button
            testID={ReferFriendsTestIDs.inviteBindRow}
            variant="tertiary"
            size="small"
            // The question stays subdued; the action reads as the action.
            color="$text"
            iconAfter="ChevronRightSmallOutline"
            onPress={handlePress}
          >
            {intl.formatMessage({
              id: ETranslations.referral_enter_code__action,
            })}
          </Button>
        </>
      )}
    </XStack>
  );
  return divided ? (
    <>
      <Divider borderColor={INVITE_CARD_BORDER_COLOR} />
      {line}
    </>
  ) : (
    line
  );
}
