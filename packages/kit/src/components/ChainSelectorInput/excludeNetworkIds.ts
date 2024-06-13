import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

export const addressBookExcludedNetworkIds = [
  getNetworkIdsMap().nostr,
  getNetworkIdsMap().lightning,
  getNetworkIdsMap().tlightning,
];

export const importedAccountExcludeNetworkIds = [
  getNetworkIdsMap().nostr,
  getNetworkIdsMap().lightning,
  getNetworkIdsMap().tlightning,
  getNetworkIdsMap().dnx,
];

export const watchAccountExcludeNetworkIds = [
  getNetworkIdsMap().nostr,
  getNetworkIdsMap().lightning,
  getNetworkIdsMap().tlightning,
];
