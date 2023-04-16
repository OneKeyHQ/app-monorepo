import { FailedToEstimatedGasError } from '@onekeyhq/engine/src/errors';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IEncodedTx,
  IFeeInfo,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';
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

export type ISignMessageParams = {
  accountId: string;
  networkId: string;
  unsignedMessage: IUnsignedMessageEvm;
};

@backgroundClass()
export default class ServiceTransaction extends ServiceBase {
  private async getPassword(accountId: string) {
    const { servicePassword, appSelector } = this.backgroundApi;
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
      throw new Error('Failed to find the password');
    }
    return password;
  }

  @backgroundMethod()
  async sendTransaction(params: ISendTransactionParams) {
    const { accountId, networkId, encodedTx, feePresetIndex, autoFallback } =
      params;
    const { engine, serviceHistory } = this.backgroundApi;
    const network = await engine.getNetwork(params.networkId);
    const password = await this.getPassword(accountId);

    let feeInfoUnit: IFeeInfoUnit | undefined;
    let feeInfo: IFeeInfo | undefined;

    try {
      feeInfo = await engine.fetchFeeInfo({
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
        ...(feeInfo.eip1559
          ? { price1559: price as EIP1559Fee }
          : { price: price as string }),
      };
    } catch {
      if (autoFallback) {
        if (network.impl === IMPL_EVM) {
          const { prices } = await engine.getGasInfo(params.networkId);
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

          const eip1559 = Boolean(
            prices?.length &&
              prices?.every((price) => typeof price === 'object'),
          );

          const price = prices[prices.length - 1];

          feeInfoUnit = {
            eip1559,
            limit: String(limit),
            ...(eip1559
              ? { price1559: price as EIP1559Fee }
              : { price: price as string }),
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

    let { payload } = params;
    if (payload?.swapInfo && payload?.swapInfo?.isApprove) {
      payload = undefined;
    }

    const { decodedTx } = await engine.decodeTx({
      networkId,
      accountId,
      encodedTx: signedTx.encodedTx,
      payload,
    });

    if (!decodedTx.feeInfo) {
      decodedTx.feeInfo = feeInfoUnit;
    }

    if (!decodedTx.totalFeeInNative) {
      if (feeInfoUnit && feeInfo) {
        const total = calculateTotalFeeRange(feeInfoUnit).max;
        decodedTx.totalFeeInNative = calculateTotalFeeNative({
          amount: total,
          info: feeInfo,
        });
      }
    }

    await serviceHistory.saveSendConfirmHistory({
      networkId,
      accountId,
      data: { signedTx, decodedTx, encodedTx: signedTx.encodedTx },
    });

    return { result: signedTx, decodedTx, encodedTx: signedTx.encodedTx };
  }

  @backgroundMethod()
  async signMessage(params: ISignMessageParams) {
    const { accountId, networkId, unsignedMessage } = params;
    const { engine } = this.backgroundApi;
    const password = await this.getPassword(accountId);
    const result = await engine.signMessage({
      password,
      networkId,
      accountId,
      unsignedMessage,
    });
    return result;
  }

  @backgroundMethod()
  async getNextTransactionNonce({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const { engine } = this.backgroundApi;
    const vault = await engine.getVault({ accountId, networkId });
    const dbAccount = await vault.getDbAccount();
    return vault.getNextNonce(networkId, dbAccount);
  }
}
