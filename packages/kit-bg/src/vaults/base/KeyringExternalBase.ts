/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import type { ISignedMessagePro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IWalletConnectChainInfo } from '@onekeyhq/shared/src/walletConnect/types';

import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import type { IDBAccount, IDBExternalAccount } from '../../dbs/local/types';
import type { IEvmWalletProvider } from '../../services/ServiceDappSide/providers/evm/EvmEIP6963Provider';
import type { WalletConnectDappSideProvider } from '../../services/ServiceWalletConnect/WalletConnectDappProvider';
import type {
  IPrepareAccountsParams,
  IPrepareExternalAccountsParams,
  ISignMessageParams,
} from '../types';

export abstract class KeyringExternalBase extends KeyringBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.external;

  async signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new OneKeyInternalError(
      'signMessage is not supported for external accounts',
    );
  }

  override prepareAccounts(
    params: IPrepareAccountsParams,
  ): Promise<IDBAccount[]> {
    throw new OneKeyInternalError(
      'prepareAccounts is not supported for external accounts, use serviceAccount directly',
    );
  }

  // TODO use serviceAccount directly
  async basePrepareExternalAccounts(
    params: IPrepareExternalAccountsParams,
  ): Promise<IDBExternalAccount[]> {
    return [];
    // const { name, networks, wcTopic, wcPeerMeta } = params;

    // if (!wcTopic || !wcPeerMeta) {
    //   throw new Error('ExternalAccounts only support walletconnect yet');
    // }

    // const account: IDBExternalAccount = {
    //   id: `${WALLET_TYPE_EXTERNAL}--wc--${wcPeerMeta?.name}`,
    //   type: EDBAccountType.VARIANT,
    //   name,
    //   networks,
    //   wcTopic,
    //   wcPeerMeta, // TODO remove
    //   address: '',
    //   path: '',
    //   coinType: '',
    //   impl: '',
    //   pub: '',
    //   addresses: {},
    // };
    // return Promise.resolve([account]);
    // const { address, name, networks, createAtNetwork } = params;
    // if (!address) {
    //   throw new InvalidAddress();
    // }
    // if (!createAtNetwork) {
    //   throw new Error(
    //     'basePrepareSimpleWatchingAccounts ERROR: createAtNetwork is not defined',
    //   );
    // }
    // const { onlyAvailableOnCertainNetworks = false } = options;
    // const settings = await this.getVaultSettings();
    // const coinType = options.coinType || settings.coinTypeDefault;
    // const impl = options.impl || settings.impl;
    // const account: IDBSimpleAccount = {
    //   id: `${WALLET_TYPE_WATCHING}--${coinType}--${address}`,
    //   name: name || '',
    //   type: EDBAccountType.SIMPLE,
    //   coinType,
    //   impl,
    //   networks: onlyAvailableOnCertainNetworks ? networks : undefined,
    //   createAtNetwork,
    //   address,
    //   pub: '',
    //   path: '',
    // };
    // return Promise.resolve([account]);
  }

  async getExternalWalletProviders(): Promise<{
    evm?: IEvmWalletProvider;
    walletConnect?: WalletConnectDappSideProvider;
    wcChainInfo?: IWalletConnectChainInfo | undefined;
  }> {
    const account = (await this.vault.getAccount()) as IDBExternalAccount;
    const evmEIP6963 = account.externalInfo?.evmEIP6963;
    const evmInjected = account.externalInfo?.evmInjected;

    if (evmInjected || evmEIP6963) {
      const { connector, provider } =
        await this.backgroundApi.serviceDappSide.getExternalConnectorEvm({
          accountId: this.accountId,
        });

      return { evm: provider };
    }

    if (account.wcTopic) {
      // TODO update account & check address matched
      const provider =
        await this.backgroundApi.serviceWalletConnect.dappSide.getOrCreateProvider(
          {
            topic: checkIsDefined(account.wcTopic),
            updateDB: true,
          },
        );
      const chainInfo =
        await this.backgroundApi.serviceWalletConnect.getChainDataByNetworkId({
          networkId: this.networkId,
        });
      if (!chainInfo?.wcChain) {
        throw new Error(
          `KeyringExternal signTransaction ERROR: Chain not supported: ${this.networkId}`,
        );
      }
      // TODO  Chain not supported checking
      // TODO open mobile app deeplink
      return { walletConnect: provider, wcChainInfo: chainInfo };
    }

    throw new Error('getEvmDappProvider ERROR: provider not found');
  }
}
