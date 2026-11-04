import type { IPrivacyChainAccountAddresses } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import { buildLocalWalletHistoryAddressGate } from '@onekeyhq/shared/src/utils/privacyChainHistoryAddressGate';
import type {
  ILocalWalletDisplayedAddressResolver,
  ILocalWalletHistoryAddressGate,
} from '@onekeyhq/shared/src/utils/privacyChainHistoryAddressGate';

import { getVaultSettings } from '../settings';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

// The account's displayed addresses, read once per history build.
export async function getLocalWalletHistoryAddressGate({
  backgroundApi,
  networkId,
  accountId,
  toDisplayedAddress,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  // The chain's reading of its own address forms; see ILocalWalletDisplayedAddressResolver.
  toDisplayedAddress?: ILocalWalletDisplayedAddressResolver;
}): Promise<ILocalWalletHistoryAddressGate> {
  const { localWallet } = await getVaultSettings({ networkId });
  const [addresses, ownerAddress] = await Promise.all([
    // Unreadable: no own address counts as displayed, so none is shown.
    (async (): Promise<IPrivacyChainAccountAddresses | undefined> =>
      backgroundApi.servicePrivacyChain.getLocalWalletAccountAddresses({
        networkId,
        accountId,
      }))().catch(() => undefined),
    (async () =>
      (await backgroundApi.serviceAccount.getDBAccountSafe({ accountId }))
        ?.address)().catch(() => undefined),
  ]);
  return buildLocalWalletHistoryAddressGate({
    localWallet,
    addresses,
    ownerAddress,
    toDisplayedAddress,
  });
}
