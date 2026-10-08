import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bulkSendUtils from '@onekeyhq/shared/src/utils/bulkSendUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IBulkSendAddressesInputSeed,
  IBulkSendAddressesInputSeedNetwork,
  IBulkSendAddressesInputSeedParams,
  IBulkSendAddressesInputSeedSender,
} from '@onekeyhq/shared/types/bulkSend';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceBulkSend extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  /**
   * Resolves the account / network / token / sender the addresses page is
   * seeded with in a single background round trip, so the page can paint
   * its first frame complete instead of filling the form in stages
   * (OK-61587). Every lookup degrades independently: a failed account
   * remap, token or sender lookup leaves that field undefined and keeps
   * the rest, so the page always receives a seed to mount on.
   */
  @backgroundMethod()
  async getAddressesInputSeed({
    networkId,
    accountId,
    indexedAccountId,
    tokenInfo,
    bulkSendMode,
  }: IBulkSendAddressesInputSeedParams): Promise<IBulkSendAddressesInputSeed> {
    const { serviceAccount } = this.backgroundApi;

    const isAllNetwork = Boolean(
      networkId && networkUtils.isAllNetwork({ networkId }),
    );
    const { fixedNetworkId, isSupported } =
      bulkSendUtils.fixBulkSendSupportedNetworkId({
        networkId: networkId ?? '',
        bulkSendMode,
      });
    const selectedNetworkId = fixedNetworkId || undefined;
    let selectedAccountId = accountId || undefined;

    const resolveAccountOnSelectedNetwork = async () => {
      if (!selectedNetworkId || !indexedAccountId) {
        return;
      }
      const networkAccounts =
        await serviceAccount.getNetworkAccountsInSameIndexedAccountId({
          networkIds: [selectedNetworkId],
          indexedAccountId,
        });
      // No account on the corrected network yet: drop the caller's account
      // rather than keep one that belongs to another network, otherwise the
      // token / sender lookups (and the page) would run against a mismatch.
      selectedAccountId = networkAccounts?.[0]?.account?.id || undefined;
    };

    // Unsupported home network: fall back to the same indexed account on
    // the corrected network. All Networks: pick the per-network account.
    if (
      (!isSupported && indexedAccountId) ||
      (isAllNetwork &&
        !accountUtils.isOthersAccount({ accountId: selectedAccountId ?? '' }))
    ) {
      try {
        await resolveAccountOnSelectedNetwork();
      } catch {
        // The caller-provided account belongs to the uncorrected network (or
        // is the All Networks pseudo account), so it cannot seed token /
        // sender lookups on `selectedNetworkId`. Resolve a partial seed
        // without an account instead of rejecting: a rejected seed left the
        // page initializing forever (sender skeleton, Next disabled), while
        // a partial one mounts the form and lets the user pick the sender.
        selectedAccountId = undefined;
      }
    }

    const [network, token] = await Promise.all([
      this.resolveNetwork({ networkId: selectedNetworkId }),
      this.resolveToken({
        tokenInfo,
        networkId: selectedNetworkId,
        accountId: selectedAccountId,
      }),
    ]);

    const seededToken: IToken | undefined = token
      ? {
          ...token,
          networkId: token.networkId ?? selectedNetworkId,
          networkName: token.networkName ?? network?.name,
        }
      : undefined;

    let sender: IBulkSendAddressesInputSeedSender | undefined;
    if (
      bulkSendMode === EBulkSendMode.OneToMany &&
      selectedNetworkId &&
      selectedAccountId
    ) {
      sender = await this.resolveSender({
        networkId: selectedNetworkId,
        accountId: selectedAccountId,
      });
    }

    return {
      accountId: selectedAccountId,
      indexedAccountId: indexedAccountId || undefined,
      networkId: selectedNetworkId,
      isSupportedNetwork: isSupported,
      token: seededToken,
      network,
      sender,
    };
  }

  private async resolveNetwork({
    networkId,
  }: {
    networkId?: string;
  }): Promise<IBulkSendAddressesInputSeedNetwork | undefined> {
    if (!networkId) {
      return undefined;
    }
    try {
      const network = await this.backgroundApi.serviceNetwork.getNetworkSafe({
        networkId,
      });
      if (!network) {
        return undefined;
      }
      return {
        id: network.id,
        name: network.name,
        logoURI: network.logoURI,
        isCustomNetwork: network.isCustomNetwork,
      };
    } catch {
      return undefined;
    }
  }

  private async resolveToken({
    tokenInfo,
    networkId,
    accountId,
  }: {
    tokenInfo?: IToken;
    networkId?: string;
    accountId?: string;
  }): Promise<IToken | undefined> {
    if (tokenInfo) {
      return tokenInfo;
    }
    if (!networkId || !accountId) {
      return undefined;
    }
    try {
      const nativeToken = await this.backgroundApi.serviceToken.getNativeToken({
        networkId,
        accountId,
        tokenInfoOnly: true,
      });
      return nativeToken ?? undefined;
    } catch {
      return undefined;
    }
  }

  private async resolveSender({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<IBulkSendAddressesInputSeedSender | undefined> {
    const { serviceAccount } = this.backgroundApi;
    try {
      const { address, account } =
        await serviceAccount.getAccountAddressInfoForApi({
          accountId,
          networkId,
        });
      if (!address) {
        return undefined;
      }
      let walletName: string | undefined;
      try {
        const wallet = await serviceAccount.getWalletSafe({
          walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
        });
        walletName = wallet?.name;
      } catch {
        walletName = undefined;
      }
      return {
        address,
        accountName: account?.name,
        walletName,
      };
    } catch {
      return undefined;
    }
  }
}

export default ServiceBulkSend;
