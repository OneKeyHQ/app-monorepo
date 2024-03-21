import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringExternalBase } from '../../base/KeyringExternalBase';

import type { IDBExternalAccount } from '../../../dbs/local/types';
import type { ISignTransactionParams } from '../../types';

export class KeyringExternal extends KeyringExternalBase {
  override coreApi: CoreChainApiBase | undefined;

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const account = (await this.vault.getAccount()) as IDBExternalAccount;
    const { signOnly } = params;

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
    if (signOnly) {
      throw new Error(
        'KeyringExternal signTransaction ERROR: signOnly not supported for WalletConnect.',
      );
    }

    // TODO add once event listener of provider.request() send, the app will be opened
    this.backgroundApi.serviceWalletConnect.dappSide.openNativeWalletAppByDeepLink(
      {
        account,
      },
    );
    const txid: string = await provider.request(
      {
        method: signOnly ? 'eth_signTransaction' : 'eth_sendTransaction',
        params: [params.unsignedTx.encodedTx],
      },
      chainInfo?.wcChain,
    );
    console.log('KeyringExternal signTransaction', params, account, txid);

    return {
      txid,
      rawTx: '',
      encodedTx: params.unsignedTx.encodedTx,
    };
  }
}
