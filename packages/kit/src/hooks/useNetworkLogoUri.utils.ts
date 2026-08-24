import {
  buildNetworkImageIdentity,
  forgetIdentityImageUrl,
  getIdentityImageUrl,
  rememberIdentityImageUrl,
} from '@onekeyhq/shared/src/utils/identityImageUrlCache';

export type IFetchedNetworkLogo = {
  logoUri: string;
  networkId?: string;
};

export function getCachedNetworkLogoUri(networkId?: string) {
  return getIdentityImageUrl(buildNetworkImageIdentity(networkId));
}

export function setCachedNetworkLogoUri({
  logoUri,
  networkId,
}: {
  logoUri?: string;
  networkId?: string;
}) {
  rememberIdentityImageUrl({
    identity: buildNetworkImageIdentity(networkId),
    url: logoUri,
  });
}

export function deleteCachedNetworkLogoUri(networkId?: string) {
  forgetIdentityImageUrl(buildNetworkImageIdentity(networkId));
}

export function resolveNetworkLogoUri({
  cachedLogoUri,
  fetchedLogo,
  logoUri,
  networkId,
}: {
  cachedLogoUri?: string;
  fetchedLogo: IFetchedNetworkLogo;
  logoUri?: string;
  networkId?: string;
}) {
  return (
    logoUri ||
    cachedLogoUri ||
    (fetchedLogo.networkId === networkId ? fetchedLogo.logoUri : '')
  );
}
