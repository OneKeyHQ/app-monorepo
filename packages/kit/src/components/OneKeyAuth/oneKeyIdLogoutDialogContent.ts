import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getOAuthSocialLoginProviderName } from '@onekeyhq/shared/src/utils/oauthProviderUtils';
import type { IIdentityExitPlan } from '@onekeyhq/shared/types/prime/identityExitTypes';

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
    const description = nextProviderName
      ? intl.formatMessage(
          {
            id: presentation.oneKeyIdWillBeLoggedOut
              ? ETranslations.remove_unavailable_keyless_wallet_for_provider_and_onekey_id__desc
              : ETranslations.remove_unavailable_keyless_wallet_for_provider__desc,
          },
          { provider: nextProviderName },
        )
      : intl.formatMessage({
          id: presentation.oneKeyIdWillBeLoggedOut
            ? ETranslations.remove_unavailable_keyless_wallet_and_onekey_id__desc
            : ETranslations.remove_unavailable_keyless_wallet__desc,
        });
    return {
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: intl.formatMessage({
        id: ETranslations.remove_unavailable_keyless_wallet__title,
      }),
      description,
      confirmText: intl.formatMessage({ id: ETranslations.global_remove }),
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
      title: intl.formatMessage(
        { id: ETranslations.switch_social_sign_in__title },
        { provider: nextProviderName },
      ),
      description: intl.formatMessage(
        {
          id:
            presentation.effect === 'linkedOneKeyIdAndKeyless'
              ? ETranslations.switch_keyless_sign_in_and_onekey_id__desc
              : ETranslations.switch_keyless_sign_in__desc,
        },
        {
          currentProvider: currentProviderName,
          nextProvider: nextProviderName,
        },
      ),
      confirmText: intl.formatMessage({ id: ETranslations.global_continue }),
    };
  }

  if (presentation.type === 'linkedOneKeyIdAndKeyless') {
    return {
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: intl.formatMessage({
        id: ETranslations.log_out_onekey_id_and_keyless__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.log_out_onekey_id_and_keyless__desc,
      }),
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
