import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { KeyringExternalBase } from '../../base/KeyringExternalBase';

import type { IDBExternalAccount } from '../../../dbs/local/types';
import type { ISignMessageParams, ISignTransactionParams } from '../../types';

export class KeyringExternal extends KeyringExternalBase {
  override coreApi: CoreChainApiBase | undefined;

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // TODO only handle first message to sign
    const firstMessageInfo = params.messages[0];

    let method: 'personal_sign' | undefined;
    if (firstMessageInfo.type === EMessageTypesEth.PERSONAL_SIGN) {
      method = 'personal_sign';
    }
    const callParams = firstMessageInfo?.payload || [];

    if (!method) {
      throw new Error('KeyringExternal signMessage ERROR: method not found');
    }

    const providers = await this.getExternalWalletProviders();

    if (providers?.evm) {
      const result = await providers?.evm.request({
        method,
        params: callParams, // TODO keep dapp raw request data in payload
      });
      return [result];
    }
    if (providers?.walletConnect) {
      const result = await providers?.walletConnect.request({
        method,
        params: callParams, // TODO keep dapp raw request data in payload
      });
      return [result as string];
    }

    throw new Error('KeyringExternal signMessage ERROR: provider not found');
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const account = (await this.vault.getAccount()) as IDBExternalAccount;
    const { signOnly } = params;
    if (signOnly) {
      throw new Error(
        'KeyringExternal signTransaction ERROR: signOnly not supported for WalletConnect.',
      );
    }

    const method = signOnly ? 'eth_signTransaction' : 'eth_sendTransaction';
    const callParams = [params.unsignedTx.encodedTx];

    const providers = await this.getExternalWalletProviders();

    let txid = '';

    if (providers.evm) {
      txid = await providers.evm.request({
        method,
        params: callParams as any,
      });
    }

    if (providers.walletConnect) {
      // TODO add once event listener of provider.request() send, the app will be opened
      this.backgroundApi.serviceWalletConnect.dappSide.openNativeWalletAppByDeepLink(
        {
          account,
        },
      );

      txid = await providers.walletConnect.request(
        {
          method,
          params: callParams,
        },
        providers?.wcChainInfo?.wcChain, // TODO override request, force to pass wcChain, open native app by deepLink
      );
    }

    console.log('KeyringExternal signTransaction', params, account, txid);

    if (txid) {
      return {
        txid,
        rawTx: '',
        encodedTx: params.unsignedTx.encodedTx,
      };
    }

    throw new Error(
      'KeyringExternal signTransaction ERROR: provider not found',
    );
  }
}
