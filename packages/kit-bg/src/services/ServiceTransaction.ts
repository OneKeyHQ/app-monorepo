import BigNumber from 'bignumber.js';

import { encodePassword } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type { IUnsignedMessage } from '@onekeyhq/engine/src/types/message';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type { IEncodedTxDot } from '@onekeyhq/engine/src/vaults/impl/dot/types';
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
import {
  FailedToEstimatedGasError,
  InsufficientGasFee,
} from '@onekeyhq/shared/src/errors';

import ServiceBase from './ServiceBase';
import { testEncodedTxDot } from './test';

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
  prepaidFee?: string;
};

export type ISignMessageParams = {
  accountId: string;
  networkId: string;
  unsignedMessage: IUnsignedMessage;
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

  private async checkAccountBalanceGreaterThan(params: {
    accountId: string;
    networkId: string;
    totalFeeInNative: string;
    prepaidFee?: string;
  }) {
    const { serviceToken, servicePassword, engine } = this.backgroundApi;
    const [result] = await serviceToken.getAccountBalanceFromRpc(
      params.networkId,
      params.accountId,
      [],
      true,
    );

    const balanceStr = result?.main?.balance;
    if (!balanceStr) {
      throw new FailedToEstimatedGasError();
    }

    const password = await servicePassword.getPassword();
    const frozenBalance = await engine.getFrozenBalance({
      accountId: params.accountId,
      networkId: params.networkId,
      password,
    });

    const frozenBalanceValue =
      typeof frozenBalance === 'number'
        ? frozenBalance
        : frozenBalance?.main ?? 0;
    const baseFee = new BigNumber(frozenBalanceValue).plus(
      params.totalFeeInNative,
    );
    const totalGas = baseFee.plus(params.prepaidFee ?? '0');
    if (new BigNumber(balanceStr).lt(totalGas)) {
      const token = await engine.getNativeTokenInfo(params.networkId);
      throw new InsufficientGasFee({
        info: {
          token: token.symbol,
          amount: baseFee.toFixed(),
        },
      });
    }
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

    const total = calculateTotalFeeRange(feeInfoUnit, network.feeDecimals).max;

    let totalFeeInNative = '';
    if (feeInfo) {
      totalFeeInNative = calculateTotalFeeNative({
        amount: total,
        info: feeInfo,
      });

      await this.checkAccountBalanceGreaterThan({
        accountId,
        networkId,
        totalFeeInNative,
        prepaidFee: params.prepaidFee ?? '0',
      });
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

    if (!decodedTx.totalFeeInNative && totalFeeInNative) {
      decodedTx.totalFeeInNative = totalFeeInNative;
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

  // $backgroundApiProxy.serviceTransaction.testDotTx()
  @backgroundMethod()
  async testDotTx() {
    const { engine } = this.backgroundApi;
    const { networkId, accountId } = await this.getActiveVault();
    const vault = await engine.getVault({ accountId, networkId });
    const tx = testEncodedTxDot as IEncodedTxDot;
    const txn = await vault.buildUnsignedTxFromEncodedTx(tx);
    const result = await vault.signAndSendTransaction(
      txn,
      {
        password: encodePassword({ password: '11111111' }),
      },
      true,
    );
    console.log('testDotTx>>>>>', result);
    return result;
  }
}
