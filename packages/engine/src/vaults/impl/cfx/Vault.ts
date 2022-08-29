/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { Conflux } from '@onekeyfe/blockchain-libs/dist/provider/chains/cfx/conflux';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import {
  PartialTokenInfo,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import { Conflux as ConfluxSDK, Contract, Drip } from 'js-conflux-sdk';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { extractResponseError, fillUnsignedTx } from '../../../proxy';
import { Account, DBAccount, DBVariantAccount } from '../../../types/account';
import { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionType,
  IDecodedTxLegacy,
  IDecodedTxStatus,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IEncodedTxUpdateType,
  IFeeInfo,
  IFeeInfoUnit,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { IEncodedTxCfx } from './types';

let confluxSDK: ConfluxSDK | null = null;

// TODO Save the corresponding contract for each token
// eslint-disable-next-line prefer-const
let contract: Contract | null = null;

// TODO extends evm/Vault
export default class Vault extends VaultBase {
  settings = settings;

  private async getConfluxInstance() {
    if (confluxSDK) return confluxSDK;
    const { rpcURL } = await this.getNetwork();
    confluxSDK = new ConfluxSDK({
      url: rpcURL,
      networkId: Number(this.networkId),
    });
    return confluxSDK;
  }

  private async getJsonRPCClient(): Promise<Conflux> {
    return (await this.engine.providerManager.getClient(
      this.networkId,
    )) as Conflux;
  }

  attachFeeInfoToEncodedTx(params: {
    encodedTx: any;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxCfx> {
    const { encodedTx, feeInfoValue } = params;
    const { limit, price } = feeInfoValue;
    const encodedTxWithFee: IEncodedTxCfx = {
      ...encodedTx,
    };

    if (limit) {
      encodedTxWithFee.gas = limit;
    }

    if (price) {
      encodedTxWithFee.gasPrice = Drip.fromCFX(price as string).toString();
    }

    return Promise.resolve(encodedTxWithFee);
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async decodeTx(encodedTx: IEncodedTxCfx): Promise<IDecodedTx> {
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);
    const account = await this.getOutputAccount();

    let transferAction: IDecodedTxAction | undefined;

    const direction = await this.buildTxActionDirection({
      from: encodedTx.from,
      to: encodedTx.to,
      address: account.address,
    });

    if (encodedTx.data) {
      const tokenInfo = await this.engine.ensureTokenInDB(
        this.networkId,
        encodedTx.to,
      );
      if (tokenInfo) {
        const { recipient, amountValue } = contract?.abi?.decodeData(
          encodedTx.data,
        ).object;
        const amount = new BigNumber(amountValue)
          .shiftedBy(tokenInfo.decimals * -1)
          .toFixed();

        transferAction = {
          type: IDecodedTxActionType.TOKEN_TRANSFER,
          direction,
          tokenTransfer: {
            tokenInfo,
            from: encodedTx.from,
            to: recipient,
            amount,
            amountValue,
            extraInfo: null,
          },
        };
      }
    } else {
      transferAction = {
        type: IDecodedTxActionType.NATIVE_TRANSFER,
        direction,
        nativeTransfer: {
          tokenInfo: nativeToken,
          from: encodedTx.from,
          to: encodedTx.to,
          amount: new Drip(encodedTx.value).toCFX(),
          amountValue: encodedTx.value,
          extraInfo: null,
        },
      };
    }

    const decodedTx: IDecodedTx = {
      txid: '',
      owner: account.address,
      signer: encodedTx.from,
      nonce: Number(encodedTx.nonce),
      actions: [transferAction].filter(Boolean),

      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,

      extraInfo: null,
    };

    return decodedTx;
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxCfx> {
    const { token, amount, from, to } = transferInfo;
    const isTransferToken = !!token;
    const conflux = await this.getConfluxInstance();

    const status = await conflux.getStatus();
    const epochNumber = await conflux.getEpochNumber();
    const nonce = (await conflux.getNextNonce(from)).toString();

    if (isTransferToken) {
      const tokenInfo = await this.engine.ensureTokenInDB(
        this.networkId,
        token ?? '',
      );
      if (!tokenInfo) {
        throw new Error(`Token not found: ${transferInfo.token as string}`);
      }

      // not sure how to get contract abi/bytecode
      /* 
      const tokenContract = conflux.Contract({
        abi: '',
        bytecode: '',
        address: tokenInfo.address,
      });

      contract = tokenContract;

      const resp = tokenContract.transfer(to, amount);
      return {
        from,
        to: resp.to,
        value: '0x0',
        data: resp.data,
        nonce,
        epochHeight: epochNumber.toString(),
        chainId: status.chainId.toString(),
      }
      */
    }

    return {
      from,
      to,
      value: Drip.fromCFX(amount).toString(),
      nonce,
      epochHeight: epochNumber.toString(),
      chainId: status.chainId.toString(),
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

  async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxCfx,
  ): Promise<IUnsignedTxPro> {
    const { from, to, value, data } = encodedTx;

    const conflux = await this.getConfluxInstance();
    const estimate = await conflux.estimateGasAndCollateral({
      from,
      to,
      value,
      data,
    });

    const unsignedTx: IUnsignedTxPro = {
      inputs: [],
      outputs: [],
      payload: {
        ...encodedTx,
        storageLimit: estimate.storageCollateralized,
      },
      encodedTx,
    };
    return unsignedTx;
  }

  async fetchFeeInfo(encodedTx: IEncodedTxCfx): Promise<IFeeInfo> {
    const network = await this.getNetwork();
    const conflux = await this.getConfluxInstance();
    const { from, to, value, data } = encodedTx;

    const gasPrice = new Drip(await conflux.getGasPrice()).toCFX();

    const estimate = await conflux.estimateGasAndCollateral({
      from,
      to,
      value,
      data,
    });

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit: estimate.gasLimit.toString(),
      prices: [gasPrice],
      defaultPresetIndex: '1',
      tx: null,
    };
  }

  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  async updateEncodedTx(
    encodedTx: IEncodedTxCfx,
    payload: IEncodedTxUpdatePayloadTransfer,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    if (options.type === IEncodedTxUpdateType.transfer) {
      encodedTx.value = Drip.fromCFX(payload.amount).toString();
    }
    return Promise.resolve(encodedTx);
  }

  override async getOutputAccount(): Promise<Account> {
    const dbAccount = (await this.getDbAccount({
      noCache: true,
    })) as DBVariantAccount;
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

  createClientFromURL(url: string): Conflux {
    return new Conflux(url);
  }

  fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    throw new NotImplemented();
  }
}
