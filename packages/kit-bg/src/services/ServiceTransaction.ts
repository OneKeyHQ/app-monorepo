import { FailedToEstimatedGasError } from '@onekeyhq/engine/src/errors';
import type {
  IEncodedTx,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';
import type { SendConfirmParams } from '@onekeyhq/kit/src/views/Send/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import ServiceBase from './ServiceBase';

export type IServiceBaseProps = {
  backgroundApi: any;
};

export type ISendTransactionParams = {
  accountId: string;
  networkId: string;
  encodedTx: IEncodedTx;
  payload?: SendConfirmParams['payloadInfo'];
  feePresetIndex?: string;
  autoFallback?: boolean;
};

@backgroundClass()
export default class ServiceTransaction extends ServiceBase {
  @backgroundMethod()
  async sendTransaction(params: ISendTransactionParams) {
    const { accountId, networkId, encodedTx, feePresetIndex, autoFallback } =
      params;
    const { engine, servicePassword, serviceHistory, appSelector } =
      this.backgroundApi;
    const network = await engine.getNetwork(params.networkId);
    const wallets = appSelector((s) => s.runtime.wallets);
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

      if (Number.isNaN(Number(feeInfo.limit))) {
        // throw Error('bad limit');
        throw new FailedToEstimatedGasError();
      }

      if (network.impl === IMPL_EVM && Number(feeInfo.limit) <= 0) {
        // throw Error('gas limit <= 0');
        throw new FailedToEstimatedGasError();
      }

      let price = feeInfo.prices[feeInfo.prices.length - 1];

      if (feePresetIndex) {
        const index = Number(feePresetIndex);
        if (!Number.isNaN(index) && feeInfo.prices[index]) {
          price = feeInfo.prices[index];
        }
      }

      feeInfoUnit = {
        eip1559: feeInfo.eip1559,
        limit: feeInfo.limit,
        price,
      };
    } catch {
      if (autoFallback) {
        if (network.impl === IMPL_EVM) {
          const gasPrice = await engine.getGasPrice(params.networkId);
          const blockData = await engine.proxyJsonRPCCall(params.networkId, {
            method: 'eth_getBlockByNumber',
            params: ['latest', false],
          });

          const blockReceipt = blockData as {
            gasLimit: string;
            gasUsed: string;
          };
          const maxLimit = +blockReceipt.gasLimit / 10;
          const gasUsed = 100 * 10000;
          const limit = Math.min(maxLimit, gasUsed);

          feeInfoUnit = {
            eip1559: typeof gasPrice[0] === 'object',
            limit: String(limit),
            price: gasPrice[gasPrice.length - 1],
          };
        }
      }
    }

    if (!feeInfoUnit) {
      throw new FailedToEstimatedGasError();
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

    if (!decodedTx.feeInfo) {
      decodedTx.feeInfo = feeInfoUnit;
    }

    await serviceHistory.saveSendConfirmHistory({
      networkId,
      accountId,
      data: { signedTx, decodedTx, encodedTx: signedTx.encodedTx },
    });

    return { result: signedTx, decodedTx, encodedTx: signedTx.encodedTx };
  }
}
