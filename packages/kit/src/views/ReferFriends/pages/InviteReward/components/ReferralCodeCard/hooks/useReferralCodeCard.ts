import { useCallback, useMemo } from 'react';

import { Share } from 'react-native';

import { useClipboard } from '@onekeyhq/components';
import { formatInviteUrlForDisplay } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  IReferralCodeCardProps,
  IUseReferralCodeCardReturn,
} from '../types';

export function useReferralCodeCard({
  inviteUrl,
  inviteCode,
}: IReferralCodeCardProps): IUseReferralCodeCardReturn {
  const { copyText, copyUrl } = useClipboard();

  const handleCopy = useCallback(() => {
    copyText(inviteCode);
    defaultLogger.referral.page.copyReferralCode();
  }, [copyText, inviteCode]);

  const inviteCodeUrl = useMemo(() => {
    return formatInviteUrlForDisplay(inviteUrl);
  }, [inviteUrl]);

  const copyLink = useCallback(() => {
    copyUrl(inviteUrl);
    defaultLogger.referral.page.shareReferralLink('copy');
  }, [copyUrl, inviteUrl]);

  const handleShare = useCallback(() => {
    setTimeout(() => {
      void Share.share(
        platformEnv.isNativeIOS
          ? {
              url: inviteUrl,
            }
          : {
              message: inviteUrl,
            },
      );
    }, 300);
    defaultLogger.referral.page.shareReferralLink('share');
  }, [inviteUrl]);

  return {
    handleCopy,
    copyLink,
    inviteCodeUrl,
    handleShare,
  };
}
