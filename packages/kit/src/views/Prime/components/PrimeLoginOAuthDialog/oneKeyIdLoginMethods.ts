import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

export type IOneKeyIdLoginMethod =
  | {
      type: 'oauth';
      provider: EOAuthSocialLoginProvider;
      requiresKeylessLogout: boolean;
      requiresMalformedKeylessRecovery?: boolean;
    }
  | {
      type: 'email';
    };

export type IOneKeyIdLoginMethodGroups = {
  primary: IOneKeyIdLoginMethod[];
  more: IOneKeyIdLoginMethod[];
};

const EMAIL_METHOD: IOneKeyIdLoginMethod = { type: 'email' };

function buildOAuthMethod({
  provider,
  requiresKeylessLogout,
  requiresMalformedKeylessRecovery,
}: {
  provider: EOAuthSocialLoginProvider;
  requiresKeylessLogout: boolean;
  requiresMalformedKeylessRecovery?: boolean;
}): IOneKeyIdLoginMethod {
  return {
    type: 'oauth',
    provider,
    requiresKeylessLogout,
    ...(requiresMalformedKeylessRecovery
      ? { requiresMalformedKeylessRecovery }
      : {}),
  };
}

export function getOneKeyIdLoginMethodGroups({
  isLocalKeylessOAuthMode,
  isLocalKeylessDataUnavailable = false,
  localKeylessProvider,
}: {
  isLocalKeylessOAuthMode: boolean;
  isLocalKeylessDataUnavailable?: boolean;
  localKeylessProvider?: EOAuthSocialLoginProvider;
}): IOneKeyIdLoginMethodGroups {
  if (!isLocalKeylessOAuthMode && !isLocalKeylessDataUnavailable) {
    return {
      primary: [
        buildOAuthMethod({
          provider: EOAuthSocialLoginProvider.Google,
          requiresKeylessLogout: false,
        }),
        buildOAuthMethod({
          provider: EOAuthSocialLoginProvider.Apple,
          requiresKeylessLogout: false,
        }),
      ],
      more: [EMAIL_METHOD],
    };
  }

  if (isLocalKeylessDataUnavailable || !localKeylessProvider) {
    return {
      primary: [
        buildOAuthMethod({
          provider: EOAuthSocialLoginProvider.Google,
          requiresKeylessLogout: false,
          requiresMalformedKeylessRecovery: true,
        }),
        buildOAuthMethod({
          provider: EOAuthSocialLoginProvider.Apple,
          requiresKeylessLogout: false,
          requiresMalformedKeylessRecovery: true,
        }),
      ],
      more: [EMAIL_METHOD],
    };
  }

  const oppositeProvider =
    localKeylessProvider === EOAuthSocialLoginProvider.Google
      ? EOAuthSocialLoginProvider.Apple
      : EOAuthSocialLoginProvider.Google;

  return {
    primary: [
      buildOAuthMethod({
        provider: localKeylessProvider,
        requiresKeylessLogout: false,
      }),
    ],
    more: [
      buildOAuthMethod({
        provider: oppositeProvider,
        requiresKeylessLogout: true,
      }),
      EMAIL_METHOD,
    ],
  };
}
