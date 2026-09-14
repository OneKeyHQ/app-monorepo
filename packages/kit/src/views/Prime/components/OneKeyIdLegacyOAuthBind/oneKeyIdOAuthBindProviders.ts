import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

const ONEKEY_ID_OAUTH_BIND_PROVIDERS = [
  EOAuthSocialLoginProvider.Google,
  EOAuthSocialLoginProvider.Apple,
] as const;

export function getOneKeyIdOAuthBindProviders({
  localKeylessProvider,
  requiredProvider,
}: {
  localKeylessProvider?: EOAuthSocialLoginProvider;
  requiredProvider?: EOAuthSocialLoginProvider;
}): EOAuthSocialLoginProvider[] {
  const preferredProvider = localKeylessProvider ?? requiredProvider;
  return preferredProvider
    ? [preferredProvider]
    : [...ONEKEY_ID_OAUTH_BIND_PROVIDERS];
}
