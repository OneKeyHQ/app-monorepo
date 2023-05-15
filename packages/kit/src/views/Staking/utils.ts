import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

export const isSupportStakedAssets = (
  networkId: string,
  tokenIdOnNetwork: string,
) =>
  !tokenIdOnNetwork &&
  (networkId === OnekeyNetwork.eth || networkId === OnekeyNetwork.goerli);
