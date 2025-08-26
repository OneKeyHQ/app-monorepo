import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISignAccount } from '@onekeyhq/shared/types/signAndVerify';

import ServiceBase from './ServiceBase';

import type { IAccountDeriveTypes } from '../vaults/types';

@backgroundClass()
class ServiceInternalSignAndVerify extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async getSignAccounts(params: {
    networkId: string;
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    isOthersWallet: boolean | undefined;
  }): Promise<ISignAccount[]> {
    const { networkId, accountId, indexedAccountId, isOthersWallet } = params;

    const networkIdsMap = getNetworkIdsMap();
    const supportedNetworkIds = [
      networkIdsMap.btc,
      networkIdsMap.eth,
      networkIdsMap.sol,
    ];

    const { serviceAccount, serviceNetwork } = this.backgroundApi;
    const results: ISignAccount[] = [];

    // Handle indexedAccountId case - iterate through all supported networks
    if (indexedAccountId) {
      for (const supportedNetworkId of supportedNetworkIds) {
        try {
          // For non-BTC networks, get the global derive type if deriveType is not provided
          const globalDeriveType =
            await serviceNetwork.getGlobalDeriveTypeOfNetwork({
              networkId: supportedNetworkId,
            });
          const network = await serviceNetwork.getNetwork({
            networkId: supportedNetworkId,
          });

          // For BTC, get all 4 derive types
          if (networkUtils.isBTCNetwork(supportedNetworkId)) {
            const btcDeriveTypes =
              await serviceNetwork.getDeriveInfoItemsOfNetwork({
                networkId: supportedNetworkId,
              });

            for (const btcDeriveType of btcDeriveTypes) {
              try {
                const btcAccount = await serviceAccount.getNetworkAccount({
                  accountId: undefined,
                  indexedAccountId,
                  networkId: supportedNetworkId,
                  deriveType: btcDeriveType.value as IAccountDeriveTypes,
                });
                if (btcAccount) {
                  results.push({
                    account: btcAccount,
                    network,
                    deriveType: btcDeriveType.value as IAccountDeriveTypes,
                    deriveLabel: btcDeriveType.label,
                  });
                }
              } catch (error) {
                console.error(
                  `Failed to get BTC account for derive type ${btcDeriveType.value}:`,
                  error,
                );
              }
            }
          } else if (globalDeriveType) {
            // For non-BTC networks (ETH, SOL)
            const account = await serviceAccount.getNetworkAccount({
              accountId: undefined,
              indexedAccountId,
              networkId: supportedNetworkId,
              deriveType: globalDeriveType,
            });

            if (account) {
              results.push({ account, deriveType: globalDeriveType, network });
            }
          }
        } catch (error) {
          console.error(
            `Failed to get network account for ${supportedNetworkId}:`,
            error,
          );
        }
      }
    }

    // Handle otherAccount case (when isOthersWallet is true and accountId exists)
    if (
      isOthersWallet &&
      accountId &&
      supportedNetworkIds.includes(networkId)
    ) {
      try {
        const dbAccount = await serviceAccount.getDBAccountSafe({ accountId });
        const network = await serviceNetwork.getNetwork({
          networkId,
        });
        if (dbAccount) {
          const account = await serviceAccount.getAccount({
            accountId,
            networkId,
            dbAccount,
          });

          if (account) {
            results.push({ account, network });
          }
        }
      } catch (error) {
        console.error('Failed to get other account:', error);
      }
    }

    return results;
  }
}

export default ServiceInternalSignAndVerify;
