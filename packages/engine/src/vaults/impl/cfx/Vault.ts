/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { defaultAbiCoder } from '@ethersproject/abi';
import {
  fromBigIntHex,
  toBigIntHex,
} from '@onekeyfe/blockchain-libs/dist/basic/bignumber-plus';
import { Conflux } from '@onekeyfe/blockchain-libs/dist/provider/chains/cfx/conflux';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import {
  EstimatedPrice,
  PartialTokenInfo,
  SignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import {
  address as ConfluxAddress,
  Conflux as ConfluxJs,
} from 'js-conflux-sdk';
import { isNil } from 'lodash';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  NotImplemented,
  OneKeyInternalError,
  PendingQueueTooLong,
} from '../../../errors';
import { extractResponseError } from '../../../proxy';
import { Account, DBAccount, DBVariantAccount } from '../../../types/account';
import { UserCreateInputCategory } from '../../../types/credential';
import { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  ISignCredentialOptions,
  ITransferInfo,
  IUserInputGuessingResult,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

export interface IEncodedTxCfx {
  from: string;
  to: string;
  value: string;
  gas?: string; // alias for gasLimit
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  feeLimit?: string;
}

export default class Vault extends VaultBase {
  settings = settings;

  // TODO: 用于替换 blockchain-libs 中的 getClient 设计
  // 这里的写法是模拟 near 的写法，但有个问题，每次调用都会生成新的对象
  // 建议后续改成单例模式
  async getCfxClient(): Promise<ConfluxJs> {
    const { rpcURL } = await this.getNetwork();
    const cfxClient = new ConfluxJs({
      url: rpcURL,
      timeout: 60 * 1000,
    });
    return cfxClient;
  }

  private async getJsonRPCClient(): Promise<Conflux> {
    return (await this.engine.providerManager.getClient(
      this.networkId,
    )) as Conflux;
  }

  async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxCfx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxCfx> {
    const { encodedTx, feeInfoValue } = params;
    const encodedTxWithFee = { ...encodedTx };
    if (!isNil(feeInfoValue.limit)) {
      encodedTxWithFee.gas = toBigIntHex(new BigNumber(feeInfoValue.limit));
      encodedTxWithFee.gasLimit = toBigIntHex(
        new BigNumber(feeInfoValue.limit),
      );
    }
    return Promise.resolve(encodedTxWithFee);
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    throw new NotImplemented();
  }

  decodeTx(encodedTx: IEncodedTx, payload?: any): Promise<IDecodedTx> {
    throw new NotImplemented();
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxCfx> {
    const network = await this.getNetwork();
    const isMax = transferInfo.max;
    const isTransferToken = Boolean(transferInfo.token);
    const isTransferNativeToken = !isTransferToken;
    const { amount } = transferInfo;
    let amountBN = new BigNumber(amount);
    if (amountBN.isNaN()) {
      amountBN = new BigNumber('0');
    }
    if (isMax && isTransferNativeToken) {
      amountBN = new BigNumber('0');
    }

    if (isTransferToken) {
      // TODO: 需要确认
      // getOrAddToken 代码 CFX IMPL 未实现，代码在 packages/engine/src/presets/token.ts
      // 目测需要在 @onekeyfe/default-token-list 中添加
      const token = await this.engine.getOrAddToken(
        this.networkId,
        transferInfo.token ?? '',
        true,
      );
      if (!token) {
        throw new Error(`Token not found: ${transferInfo.token as string}`);
      }
      return {
        from: transferInfo.from,
        to: transferInfo.token ?? '',
        value: '0x0',
      };
    }

    const amountHex = toBigIntHex(amountBN.shiftedBy(network.decimals));
    return {
      from: transferInfo.from,
      to: transferInfo.to,
      value: amountHex,
    };
  }

  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<any> {
    throw new Error('Method not implemented.');
  }

  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  async getAddresses(addresses: Array<string>): Promise<
    Array<
      | {
          balance: BigNumber;
          existing: boolean;
          nonce?: number | undefined;
        }
      | undefined
    >
  > {
    const cfxClient = await this.getCfxClient();
    const resp: any = await Promise.all(
      addresses.reduce((acc: Array<any>, cur) => {
        acc.push(cfxClient.getBalance(cur));
        acc.push(cfxClient.getNextNonce(cur));
      }, []),
    );
    const result = [];

    for (let i = 0, count = resp.length; i < count; i += 2) {
      const [balanceHex, nonceHex] = resp.slice(i, i + 2);
      let info;

      if (
        typeof balanceHex !== 'undefined' &&
        typeof nonceHex !== 'undefined'
      ) {
        const balance = fromBigIntHex(balanceHex);
        const nonce = parseInt(nonceHex, 16);
        if (!balance.isNaN() && !isNaN(nonce)) {
          info = {
            balance,
            nonce,
            existing: balance.gt(0) || nonce > 0,
          };
        }
      }

      result.push(info);
    }

    return result;
  }

  async getFeePricePerUnit(): Promise<{
    normal: EstimatedPrice;
    others?: EstimatedPrice[] | undefined;
  }> {
    const cfxClient = await this.getCfxClient();
    const gasPriceHex: string = (await cfxClient.getGasPrice()).toString();
    const gasPrice = fromBigIntHex(gasPriceHex);

    const slow =
      !gasPrice.isNaN() && gasPrice.gt(1) ? gasPrice : new BigNumber(1);
    const normal = slow.multipliedBy(1.25).integerValue(BigNumber.ROUND_CEIL);
    const fast = normal.multipliedBy(1.2).integerValue(BigNumber.ROUND_CEIL); // 1.25 * 1.2 = 1.5

    return {
      normal: { price: normal, waitingBlock: 2 },
      others: [
        { price: slow, waitingBlock: 10 },
        { price: fast, waitingBlock: 1 },
      ],
    };
  }

  // TODO: 参考了 blockchain-libs 中 cfx provider 的 buildencodedTx 的实现
  async buildUnsignedTxFromEncodedTx(encodedTx: any): Promise<any> {
    const cfxClient = await this.getCfxClient();
    const input = encodedTx.inputs[0];
    const output = encodedTx.outputs[0];

    const payload = encodedTx.payload || {};
    let { nonce } = encodedTx;
    let { feeLimit } = encodedTx;

    if (input && output) {
      const fromAddress = input.address;
      const { tokenAddress } = output;
      let toAddress = output.address;
      let value: string = toBigIntHex(output.value);
      let data: string | undefined;
      if (tokenAddress) {
        toAddress = `0x${ConfluxAddress.decodeCfxAddress(
          toAddress,
        ).hexAddress.toString('hex')}`;
        data = `0xa9059cbb${defaultAbiCoder
          .encode(['address', 'uint256'], [toAddress, value])
          .slice(2)}`; // method_selector(transfer) + byte32_pad(address) + byte32_pad(value)
        value = '0x0';
        toAddress = tokenAddress;
      } else {
        data = payload.data;
      }

      if (typeof data === 'string' && data) {
        payload.data = data;
      }

      if (!feeLimit) {
        const resp: any = await cfxClient.estimateGasAndCollateral({
          from: fromAddress,
          to: toAddress,
          value,
          data: data || '0x',
        });
        const estimatedGasLimit = resp.gasUsed || '0x0';
        const estimatedGasLimitBN = fromBigIntHex(estimatedGasLimit);

        const chainInfo =
          await this.engine.providerManager.getChainInfoByNetworkId(
            this.networkId,
          );
        const multiplier =
          chainInfo.implOptions.contract_gaslimit_multiplier || 1.2;
        let code = await cfxClient.getCode(toAddress);
        if (code && code.startsWith('0x')) {
          code = code.slice(2);
        }
        feeLimit =
          tokenAddress || code
            ? estimatedGasLimitBN.multipliedBy(multiplier).integerValue()
            : estimatedGasLimitBN;
      }

      if (typeof nonce !== 'number' || nonce < 0) {
        const [addressInfo] = await this.getAddresses([fromAddress]);
        nonce = addressInfo?.nonce;
      }
      const resp: any = await cfxClient.estimateGasAndCollateral({
        from: fromAddress,
        to: toAddress,
        value,
        data: data || '0x',
      });
      const storageLimit = resp.storageCollateralized || '0x0';
      const epochHeight = await cfxClient.getEpochNumber();
      payload.storageLimit = fromBigIntHex(storageLimit);
      payload.epochHeight = epochHeight;
    }

    const feePricePerUnit =
      encodedTx.feePricePerUnit ||
      (await this.getFeePricePerUnit().normal.price);
    feeLimit = feeLimit || new BigNumber(21000);

    return Object.assign(encodedTx, {
      inputs: input ? [input] : [],
      outputs: output ? [output] : [],
      nonce,
      feeLimit,
      feePricePerUnit,
      payload,
    });
  }

  async fetchFeeInfo(encodedTx: any): Promise<IFeeInfo> {
    const client = await this.getCfxClient();
    const { gas, gasLimit, ...encodedTxWithFakePriceAndNonce } = {
      ...encodedTx,
      nonce: 1,
      gasPrice: '1',
    };

    const [network, price, unsignedTx] = await Promise.all([
      this.getNetwork(),
      client.getGasPrice(),
      this.buildUnsignedTxFromEncodedTx(encodedTxWithFakePriceAndNonce),
    ]);

    const limit = BigNumber.max(
      unsignedTx.feeLimit ?? '0',
      gas ?? '0',
      gasLimit ?? '0',
    ).toFixed();
    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      symbol: network.feeSymbol,
      decimals: network.feeDecimals,
      limit,
      prices: [price.toString()],
      defaultPresetIndex: '0',
      tx: null, // Must be null if network not support feeInTx
    };
  }

  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
  };

  private async _correctDbAccountAddress(dbAccount: DBAccount) {
    dbAccount.address = await this.engine.providerManager.selectAccountAddress(
      this.networkId,
      dbAccount,
    );
  }

  async simpleTransfer(
    payload: {
      to: string;
      value: string;
      tokenIdOnNetwork?: string;
      extra?: { [key: string]: any };
      gasPrice: string; // TODO remove gasPrice
      gasLimit: string;
    },
    options: ISignCredentialOptions,
  ) {
    debugLogger.engine('CFX simpleTransfer', payload);
    const { to, value, tokenIdOnNetwork, extra, gasLimit, gasPrice } = payload;
    const { networkId } = this;
    const network = await this.getNetwork();
    const dbAccount = await this.getDbAccount();
    // TODO what's this mean: correctDbAccountAddress
    await this._correctDbAccountAddress(dbAccount);
    const token = await this.engine.getOrAddToken(
      networkId,
      tokenIdOnNetwork ?? '',
      true,
    );
    const valueBN = new BigNumber(value);
    const extraCombined = {
      ...extra,
      feeLimit: new BigNumber(gasLimit),
      feePricePerUnit: new BigNumber(gasPrice),
    };
    // TODO buildencodedTx
    const encodedTx = await this.engine.providerManager.buildencodedTx(
      networkId,
      fillencodedTx(network, dbAccount, to, valueBN, token, extraCombined),
    );
    return this.signAndSendTransaction(encodedTx, options);
  }

  async updateEncodedTx(
    encodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override async getOutputAccount(): Promise<Account> {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const ret = {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.addresses?.[this.networkId] || '',
    };
    if (ret.address.length === 0) {
      // TODO: remove selectAccountAddress from proxy
      const address = await this.engine.providerManager.selectAccountAddress(
        this.networkId,
        dbAccount,
      );
      await this.engine.dbApi.addAccountAddress(
        dbAccount.id,
        this.networkId,
        address,
      );
      ret.address = address;
    }
    return ret;
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return `0x${decrypt(password, encryptedPrivateKey).toString('hex')}`;
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  // Chain only functionalities below.

  async guessUserCreateInput(input: string): Promise<IUserInputGuessingResult> {
    const ret = [];
    if (
      this.settings.importedAccountEnabled &&
      /^(0x)?[0-9a-zA-Z]{64}$/.test(input)
    ) {
      ret.push(UserCreateInputCategory.PRIVATE_KEY);
    }
    if (
      this.settings.watchingAccountEnabled &&
      (await this.engineProvider.verifyAddress(input)).isValid
    ) {
      ret.push(UserCreateInputCategory.ADDRESS);
    }
    return Promise.resolve(ret);
  }

  override async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    const client = await this.getJsonRPCClient();
    try {
      return await client.rpc.call(
        request.method,
        request.params as Record<string, any> | Array<any>,
      );
    } catch (e) {
      throw extractResponseError(e);
    }
  }

  createClientFromURL(url: string): any {
    // TODO: 需要确认
    // 废弃 blockchain-libs 的话，这个方法就不使用了，我看 near 也没实现了
    // return new ConfluxJs({ url });
  }

  fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    throw new NotImplemented();
  }

  override async broadcastTransaction(
    rawTx: any,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const signedTx = await this.signTransaction(rawTx, options);
    const cfxClient = await this.getCfxClient();
    const hash = await cfxClient.sendRawTransaction(signedTx.rawTx);
    return {
      txid: hash,
      rawTx: signedTx.rawTx,
    };
  }
}
