import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import {
  EOneKeyIdIdentityType,
  EOneKeyIdOAuthProvider,
} from '@onekeyhq/shared/types/prime/primeTypes';
import type { IOneKeyIdAccount } from '@onekeyhq/shared/types/prime/primeTypes';

// Icon keys come from the components icon set (`IKeyOfIcons`), but shared must
// not import `@onekeyhq/components`, so keep them as string literals that stay
// assignable to `IKeyOfIcons` at call sites.
export type IOAuthProviderIconName = 'GoogleIllus' | 'AppleBrand';

export type IOAuthProviderDescriptor = {
  name: string;
  icon: IOAuthProviderIconName;
};

const GOOGLE_OAUTH_PROVIDER_DESCRIPTOR: IOAuthProviderDescriptor = {
  name: 'Google',
  icon: 'GoogleIllus',
};

const APPLE_OAUTH_PROVIDER_DESCRIPTOR: IOAuthProviderDescriptor = {
  name: 'Apple',
  icon: 'AppleBrand',
};

// Display order of OneKey ID OAuth providers across the app (avatar badges,
// bind status, etc.).
export const ONEKEY_ID_OAUTH_PROVIDER_ORDER: EOneKeyIdOAuthProvider[] = [
  EOneKeyIdOAuthProvider.Google,
  EOneKeyIdOAuthProvider.Apple,
];

// `EOneKeyIdOAuthProvider` (server-side OneKey ID identity provider) and
// `EOAuthSocialLoginProvider` (client-side social login provider) are distinct
// enums that currently expose the same providers, so both maps reference the
// same descriptors. Keep them keyed separately instead of force-merging the
// enums.
const ONEKEY_ID_OAUTH_PROVIDER_DESCRIPTORS: Record<
  EOneKeyIdOAuthProvider,
  IOAuthProviderDescriptor
> = {
  [EOneKeyIdOAuthProvider.Google]: GOOGLE_OAUTH_PROVIDER_DESCRIPTOR,
  [EOneKeyIdOAuthProvider.Apple]: APPLE_OAUTH_PROVIDER_DESCRIPTOR,
};

const OAUTH_SOCIAL_LOGIN_PROVIDER_DESCRIPTORS: Record<
  EOAuthSocialLoginProvider,
  IOAuthProviderDescriptor
> = {
  [EOAuthSocialLoginProvider.Google]: GOOGLE_OAUTH_PROVIDER_DESCRIPTOR,
  [EOAuthSocialLoginProvider.Apple]: APPLE_OAUTH_PROVIDER_DESCRIPTOR,
};

export function getOneKeyIdOAuthProviderName(
  provider: EOneKeyIdOAuthProvider,
): string {
  const descriptor: IOAuthProviderDescriptor | undefined =
    ONEKEY_ID_OAUTH_PROVIDER_DESCRIPTORS[provider];
  // Unknown providers fall back to the raw provider value instead of being
  // mislabeled with a hardcoded provider name.
  return descriptor?.name ?? String(provider);
}

export function getOneKeyIdOAuthProviderIcon(
  provider: EOneKeyIdOAuthProvider,
): IOAuthProviderIconName {
  const descriptor: IOAuthProviderDescriptor | undefined =
    ONEKEY_ID_OAUTH_PROVIDER_DESCRIPTORS[provider];
  // Keep the historical Apple icon fallback for out-of-enum runtime values;
  // TypeScript exhaustiveness on the record covers all known providers.
  return (descriptor ?? APPLE_OAUTH_PROVIDER_DESCRIPTOR).icon;
}

export function getOAuthSocialLoginProviderName(
  provider: EOAuthSocialLoginProvider | undefined,
): string {
  if (!provider) {
    return '';
  }
  const descriptor: IOAuthProviderDescriptor | undefined =
    OAUTH_SOCIAL_LOGIN_PROVIDER_DESCRIPTORS[provider];
  // Unknown providers fall back to the raw provider value instead of being
  // mislabeled with a hardcoded provider name.
  return descriptor?.name ?? String(provider);
}

export function getBoundOAuthProviders(
  onekeyAccount: IOneKeyIdAccount | undefined,
): EOneKeyIdOAuthProvider[] {
  const providerSet = new Set<EOneKeyIdOAuthProvider>();
  onekeyAccount?.identities?.forEach((identity) => {
    if (
      identity.identityType === EOneKeyIdIdentityType.OAuth &&
      identity.oauthProvider
    ) {
      providerSet.add(identity.oauthProvider);
    }
  });
  return ONEKEY_ID_OAUTH_PROVIDER_ORDER.filter((provider) =>
    providerSet.has(provider),
  );
}
