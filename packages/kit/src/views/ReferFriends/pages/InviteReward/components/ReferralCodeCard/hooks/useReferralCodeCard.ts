import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { Share } from 'react-native';

import { useClipboard } from '@onekeyhq/components';
import { formatInviteUrlForDisplay } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();

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
    intl: {
      yourCode: intl.formatMessage({ id: ETranslations.referral_your_code }),
      referred: intl.formatMessage({ id: ETranslations.referral_referred }),
      copy: intl.formatMessage({ id: ETranslations.global_copy }),
      share: intl.formatMessage({ id: ETranslations.explore_share }),
      referralCode: intl.formatMessage({
        id: ETranslations.referral_your_code,
      }),
      referralLink: intl.formatMessage({
        id: ETranslations.referral_referral_link,
      }),
    },
  };
}
