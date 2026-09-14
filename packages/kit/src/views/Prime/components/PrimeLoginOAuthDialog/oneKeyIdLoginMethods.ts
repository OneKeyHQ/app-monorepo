import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

// Email sign-in is always available and rendered unconditionally by the
// dialog; this module only decides which OAuth buttons show and how they
// behave.
export type IOneKeyIdLoginMethod = {
  type: 'oauth';
  provider: EOAuthSocialLoginProvider;
  requiresKeylessLogout: boolean;
  requiresMalformedKeylessRecovery?: boolean;
};

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

export function getOneKeyIdLoginMethods({
  isLocalKeylessOAuthMode,
  isLocalKeylessDataUnavailable = false,
  localKeylessProvider,
}: {
  isLocalKeylessOAuthMode: boolean;
  isLocalKeylessDataUnavailable?: boolean;
  localKeylessProvider?: EOAuthSocialLoginProvider;
}): IOneKeyIdLoginMethod[] {
  if (!isLocalKeylessOAuthMode && !isLocalKeylessDataUnavailable) {
    return [
      buildOAuthMethod({
        provider: EOAuthSocialLoginProvider.Google,
        requiresKeylessLogout: false,
      }),
      buildOAuthMethod({
        provider: EOAuthSocialLoginProvider.Apple,
        requiresKeylessLogout: false,
      }),
    ];
  }

  if (isLocalKeylessDataUnavailable || !localKeylessProvider) {
    return [
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
    ];
  }

  const oppositeProvider =
    localKeylessProvider === EOAuthSocialLoginProvider.Google
      ? EOAuthSocialLoginProvider.Apple
      : EOAuthSocialLoginProvider.Google;

  return [
    buildOAuthMethod({
      provider: localKeylessProvider,
      requiresKeylessLogout: false,
    }),
    buildOAuthMethod({
      provider: oppositeProvider,
      requiresKeylessLogout: true,
    }),
  ];
}
