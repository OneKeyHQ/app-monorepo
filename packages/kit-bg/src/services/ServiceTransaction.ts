import type {
  IEncodedTx,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';
import type { SendConfirmParams } from '@onekeyhq/kit/src/views/Send/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

export type IServiceBaseProps = {
  backgroundApi: any;
};

@backgroundClass()
export default class ServiceTransaction extends ServiceBase {
  @backgroundMethod()
  async sendTransaction(params: {
    accountId: string;
    networkId: string;
    encodedTx: IEncodedTx;
    payload?: SendConfirmParams['payloadInfo'];
  }) {
    const { accountId, networkId, encodedTx } = params;
    const { engine, servicePassword, serviceHistory } = this.backgroundApi;

    const wallets = await engine.getWallets();
    const activeWallet = wallets.find((wallet) =>
      wallet.accounts.includes(accountId),
    );

    let password: string | undefined;
    if (activeWallet?.type === 'hw') {
      password = '';
    } else {
      password = await servicePassword.getPassword();
    }

    if (password === undefined) {
      throw new Error('Internal Error');
    }

    let feeInfoUnit: IFeeInfoUnit | undefined;

    try {
      const feeInfo = await engine.fetchFeeInfo({
        accountId,
        networkId,
        encodedTx,
      });

      if (Number.isNaN(Number(feeInfo.limit)) || Number(feeInfo.limit) <= 0) {
        throw Error('bad limit');
      }

      const price = feeInfo.prices[feeInfo.prices.length - 1];

      feeInfoUnit = {
        eip1559: feeInfo.eip1559,
        limit: feeInfo.limit,
        price,
      };
    } catch {
      const gasPrice = await engine.getGasPrice(params.networkId);

      const blockData = await engine.proxyJsonRPCCall(params.networkId, {
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
      });

      const blockReceipt = blockData as { gasLimit: string };

      feeInfoUnit = {
        eip1559: typeof gasPrice[0] === 'object',
        limit: String(+blockReceipt.gasLimit / 10),
        price: gasPrice[gasPrice.length - 1],
      };
    }

    const encodedTxWithFee = await engine.attachFeeInfoToEncodedTx({
      networkId,
      accountId,
      encodedTx,
      feeInfoValue: feeInfoUnit,
    });

    const signedTx = await engine.signAndSendEncodedTx({
      encodedTx: encodedTxWithFee,
      networkId,
      accountId,
      password,
      signOnly: false,
    });

    if (!signedTx.encodedTx) {
      throw new Error('signedTx.encodedTx is missing, please check code');
    }

    const { decodedTx } = await engine.decodeTx({
      networkId,
      accountId,
      encodedTx: signedTx.encodedTx,
      payload: params.payload,
    });

    await serviceHistory.saveSendConfirmHistory({
      networkId,
      accountId,
      data: { signedTx, decodedTx, encodedTx: signedTx.encodedTx },
    });

    return { result: signedTx, decodedTx, encodedTx: signedTx.encodedTx };
  }
}
