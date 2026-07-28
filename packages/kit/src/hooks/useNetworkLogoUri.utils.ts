export type IFetchedNetworkLogo = {
  logoUri: string;
  networkId?: string;
};

export function resolveNetworkLogoUri({
  fetchedLogo,
  logoUri,
  networkId,
}: {
  fetchedLogo: IFetchedNetworkLogo;
  logoUri?: string;
  networkId?: string;
}) {
  return (
    logoUri || (fetchedLogo.networkId === networkId ? fetchedLogo.logoUri : '')
  );
}
