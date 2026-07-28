import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getOAuthSocialLoginProviderName } from '@onekeyhq/shared/src/utils/oauthProviderUtils';
import type { IIdentityExitPlan } from '@onekeyhq/shared/types/prime/identityExitTypes';

import {
  ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_DESCRIPTION,
  ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_TITLE,
} from './oneKeyIdLogoutConsts';

import type { IntlShape } from 'react-intl';

type IReadyIdentityExitPlan = Extract<IIdentityExitPlan, { status: 'ready' }>;

type IOneKeyIdLogoutDialogContentConfig = {
  icon: 'ErrorOutline' | 'InfoCircleOutline';
  tone?: 'destructive';
  title: string;
  description: string;
  confirmText: string;
};

function getBaseOneKeyIdLogoutDialogContent({
  intl,
  plan,
}: {
  intl: IntlShape;
  plan: IReadyIdentityExitPlan;
}): IOneKeyIdLogoutDialogContentConfig {
  const { presentation } = plan;
  if (presentation.type === 'recoverMalformedKeyless') {
    const nextProviderName = presentation.nextProvider
      ? getOAuthSocialLoginProviderName(presentation.nextProvider)
      : undefined;
    return {
      icon: 'ErrorOutline',
      tone: 'destructive',
      // TODO: i18n
      title: 'Remove Unavailable Keyless Wallet?',
      // TODO: i18n
      description: `The local Keyless wallet data cannot be read correctly. ${
        nextProviderName
          ? `To continue with ${nextProviderName}, first remove this Keyless wallet from this device.`
          : 'Remove this Keyless wallet from this device to continue.'
      }${
        presentation.oneKeyIdWillBeLoggedOut
          ? ' The OneKey ID session backed by this Keyless wallet will also be logged out.'
          : ''
      }`,
      confirmText: intl.formatMessage({ id: ETranslations.global_logout }),
    };
  }
  if (presentation.type === 'switchOAuthProvider') {
    const currentProviderName = getOAuthSocialLoginProviderName(
      presentation.currentProvider,
    );
    const nextProviderName = getOAuthSocialLoginProviderName(
      presentation.nextProvider,
    );
    return {
      icon: 'ErrorOutline',
      tone: 'destructive',
      // TODO: i18n (use a complete message with provider placeholders)
      title: `Switch to ${nextProviderName} Sign-In?`,
      // TODO: i18n (use a complete message with provider placeholders)
      description: `You're currently using ${currentProviderName} Keyless. Continuing with ${nextProviderName} will log out and remove this Keyless wallet from this device.`,
      confirmText: intl.formatMessage({ id: ETranslations.global_logout }),
    };
  }

  if (presentation.type === 'linkedOneKeyIdAndKeyless') {
    return {
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_TITLE,
      description: ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_DESCRIPTION,
      confirmText: intl.formatMessage({ id: ETranslations.global_logout }),
    };
  }

  if (presentation.type === 'keylessOnly') {
    return {
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: intl.formatMessage({ id: ETranslations.log_out_wallet }),
      description: '',
      confirmText: intl.formatMessage({ id: ETranslations.global_logout }),
    };
  }

  return {
    icon: 'InfoCircleOutline',
    title: intl.formatMessage({ id: ETranslations.prime_onekeyid_log_out }),
    description: intl.formatMessage({
      id: ETranslations.prime_onekeyid_log_out_description,
    }),
    confirmText: intl.formatMessage({ id: ETranslations.prime_log_out }),
  };
}

export function getOneKeyIdLogoutDialogContent({
  intl,
  plan,
}: {
  intl: IntlShape;
  plan: IReadyIdentityExitPlan;
}): IOneKeyIdLogoutDialogContentConfig {
  const content = getBaseOneKeyIdLogoutDialogContent({ intl, plan });
  if (plan.confirmation.type !== 'keylessRemovalAcknowledgement') {
    return content;
  }
  const requiredKeylessRecoveryDescription = intl.formatMessage({
    id: ETranslations.log_out_wallet_desc,
  });
  return {
    ...content,
    description: [content.description, requiredKeylessRecoveryDescription]
      .filter(Boolean)
      .join('\n\n'),
  };
}
