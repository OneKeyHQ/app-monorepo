import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { Share } from 'react-native';

import { useClipboard } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigateToYourReferred } from '../../../../YourReferred/hooks/useNavigateToYourReferred';

import type {
  IReferralCodeCardProps,
  IUseReferralCodeCardReturn,
} from '../types';

export function useReferralCodeCard({
  inviteUrl,
  inviteCode,
}: IReferralCodeCardProps): IUseReferralCodeCardReturn {
  const toYourReferredPage = useNavigateToYourReferred();
  const { copyText } = useClipboard();
  const intl = useIntl();

  const handleCopy = useCallback(() => {
    copyText(inviteCode);
    defaultLogger.referral.page.copyReferralCode();
  }, [copyText, inviteCode]);

  const inviteCodeUrl = useMemo(() => {
    return inviteUrl.replace('https://', '');
  }, [inviteUrl]);

  const sharedUrl = useMemo(() => `https://${inviteCodeUrl}`, [inviteCodeUrl]);

  const copyLink = useCallback(() => {
    copyText(sharedUrl);
    defaultLogger.referral.page.shareReferralLink('copy');
  }, [copyText, sharedUrl]);

  const handleShare = useCallback(() => {
    setTimeout(() => {
      void Share.share(
        platformEnv.isNativeIOS
          ? {
              url: sharedUrl,
            }
          : {
              message: sharedUrl,
            },
      );
    }, 300);
    defaultLogger.referral.page.shareReferralLink('share');
  }, [sharedUrl]);

  return {
    handleCopy,
    copyLink,
    inviteCodeUrl,
    toYourReferredPage,
    sharedUrl,
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
