import { getDisplayEmailOrUnknown } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdDisplayEmailUtils';
import {
  getBoundOAuthProviders,
  getOneKeyIdOAuthProviderName,
} from '@onekeyhq/shared/src/utils/oauthProviderUtils';
import type {
  EOneKeyIdOAuthProvider,
  IOneKeyIdAccount,
} from '@onekeyhq/shared/types/prime/primeTypes';

import type { IntlShape } from 'react-intl';

const ONEKEY_ID_ACTION_TITLE = 'OneKey ID';

export function getRedeemLandingAccountNickname(
  nickname: string | undefined,
): string | undefined {
  const trimmedNickname = nickname?.trim();
  return trimmedNickname || undefined;
}

export function getRedeemLandingAccountLabel({
  displayEmail,
  intl,
  nickname,
}: {
  displayEmail: string | undefined;
  intl: IntlShape;
  nickname: string | undefined;
}): string {
  return (
    getRedeemLandingAccountNickname(nickname) ||
    getDisplayEmailOrUnknown({
      displayEmail,
      intl,
    })
  );
}

export function getRedeemLandingSuccessAccountLabel({
  displayEmail,
  intl,
  maskedEmail,
  nickname,
}: {
  displayEmail: string | undefined;
  intl: IntlShape;
  maskedEmail: string | undefined;
  nickname: string | undefined;
}): string {
  return (
    getRedeemLandingAccountNickname(nickname) ||
    maskedEmail ||
    getDisplayEmailOrUnknown({
      displayEmail,
      intl,
    })
  );
}

export function getRedeemLandingOAuthIdentity(
  onekeyAccount: IOneKeyIdAccount | undefined,
): {
  oauthProviderNames: string[];
  oauthProviders: EOneKeyIdOAuthProvider[];
} {
  const oauthProviders = getBoundOAuthProviders(onekeyAccount);
  return {
    oauthProviderNames: oauthProviders.map(getOneKeyIdOAuthProviderName),
    oauthProviders,
  };
}

export function getRedeemLandingAccountActionTitle(
  oauthProviderNames: string[],
): string {
  if (!oauthProviderNames.length) {
    return ONEKEY_ID_ACTION_TITLE;
  }
  return `${ONEKEY_ID_ACTION_TITLE} · ${oauthProviderNames.join(' · ')}`;
}

export function getRedeemLandingAccountAccessibilityLabel({
  accountLabel,
  displayEmail,
  oauthProviderNames,
}: {
  accountLabel: string;
  displayEmail: string | undefined;
  oauthProviderNames: string[];
}): string {
  const parts = [...oauthProviderNames, accountLabel];
  const trimmedEmail = displayEmail?.trim();
  if (trimmedEmail && trimmedEmail !== accountLabel) {
    parts.push(trimmedEmail);
  }
  return parts.join(' · ');
}

export function shouldShowRedeemLandingMaskedEmail({
  accountLabel,
  maskedEmail,
  nickname,
}: {
  accountLabel: string;
  maskedEmail: string | undefined;
  nickname: string | undefined;
}): boolean {
  return Boolean(
    getRedeemLandingAccountNickname(nickname) &&
    maskedEmail &&
    maskedEmail !== accountLabel,
  );
}
