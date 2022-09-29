/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { defaultAbiCoder } from '@ethersproject/abi';
import { toBigIntHex } from '@onekeyfe/blockchain-libs/dist/basic/bignumber-plus';
import { BaseClient } from '@onekeyfe/blockchain-libs/dist/provider/abc';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import {
  PartialTokenInfo,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import { Conflux, address as confluxAddress } from 'js-conflux-sdk';
import { isNil } from 'lodash';
import memoizee from 'memoizee';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
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
  ISignCredentialOptions,
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
import { parseTransaction } from './utils';

const TOKEN_TRANSFER_FUNCTION_SIGNATURE = '0xa9059cbb';
// TODO extends evm/Vault
export default class Vault extends VaultBase {
  settings = settings;

  getClientCache = memoizee(
    async (rpcUrl, chainId) => this.getConfluxClient(rpcUrl, chainId),
    {
      promise: true,
      max: 1,
    },
  );

  async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    const chainId = await this.getNetworkChainId();
    return this.getClientCache(rpcURL, chainId);
  }

  getConfluxClient(url: string, chainId: string) {
    return new Conflux({
      url,
      networkId: Number(chainId),
    });
  }

  async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxCfx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxCfx> {
    const network = await this.getNetwork();
    const { encodedTx, feeInfoValue } = params;
    const { limit, price } = feeInfoValue;
    const encodedTxWithFee: IEncodedTxCfx = {
      ...encodedTx,
    };

    if (!isNil(limit)) {
      encodedTxWithFee.gas = toBigIntHex(new BigNumber(limit));
      encodedTxWithFee.gasLimit = toBigIntHex(new BigNumber(limit));
    }

    if (!isNil(price)) {
      encodedTxWithFee.gasPrice = toBigIntHex(
        new BigNumber(price as string).shiftedBy(network.feeDecimals),
      );
    }

    return Promise.resolve(encodedTxWithFee);
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  async decodeTx(encodedTx: IEncodedTxCfx, payload?: any): Promise<IDecodedTx> {
    const { address } = await this.getOutputAccount();

    const decodedTx: IDecodedTx = {
      txid: '',
      owner: address,
      signer: address,
      nonce: 0,
      actions: (await this.buildEncodedTxAction(encodedTx)).filter(Boolean),
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      extraInfo: null,
    };

    return decodedTx;
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxCfx> {
    const network = await this.getNetwork();
    const { amount } = transferInfo;
    const isTransferToken = Boolean(transferInfo.token);
    let amountBN = new BigNumber(amount);
    if (amountBN.isNaN()) {
      amountBN = new BigNumber('0');
    }

    const amountHex = toBigIntHex(amountBN.shiftedBy(network.decimals));

    if (isTransferToken) {
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        transferInfo.token ?? '',
      );
      if (!token) {
        throw new Error(`Token not found: ${transferInfo.token as string}`);
      }

      const toAddress = `0x${confluxAddress
        .decodeCfxAddress(transferInfo.to)
        .hexAddress.toString('hex')}`;

      const data = `${TOKEN_TRANSFER_FUNCTION_SIGNATURE}${defaultAbiCoder
        .encode(['address', 'uint256'], [toAddress, amountHex])
        .slice(2)}`;

      return {
        from: transferInfo.from,
        to: transferInfo.token ?? '',
        value: '0x0',
        data,
      };
    }

    return {
      from: transferInfo.from,
      to: transferInfo.to,
      value: amountHex,
      data: '0x',
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
    const client = await this.getClient();

    const [status, nonce, estimate] = await Promise.all([
      client.getStatus(),
      client.getNextNonce(encodedTx.from),
      client.estimateGasAndCollateral({
        from,
        to,
        value,
        data,
      }),
    ]);

    encodedTx.nonce = Number(nonce);
    encodedTx.epochHeight = status.epochNumber;
    encodedTx.chainId = status.chainId;
    encodedTx.storageLimit = estimate.storageCollateralized;

    const unsignedTx: IUnsignedTxPro = {
      inputs: [],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    };
    return Promise.resolve(unsignedTx);
  }

  async fetchFeeInfo(encodedTx: any): Promise<IFeeInfo> {
    const { gas, gasLimit } = encodedTx;

    const network = await this.getNetwork();
    const client = await this.getClient();
    const { from, to, value, data } = encodedTx;

    const [gasPrice, estimate] = await Promise.all([
      client.getGasPrice(),
      client.estimateGasAndCollateral({
        from,
        to,
        value,
        data,
      }),
    ]);

    const limit = BigNumber.max(
      estimate.gasLimit ?? '0',
      gas ?? '0',
      gasLimit ?? '0',
    ).toFixed();

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit,
      prices: [
        new BigNumber(gasPrice.toString())
          .shiftedBy(-network.decimals)
          .toFixed(),
      ],
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
      const network = await this.getNetwork();
      encodedTx.value = new BigNumber(payload.amount)
        .shiftedBy(network.decimals)
        .toFixed();
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

  override async getAccountBalance(tokenIds: Array<string>, withMain = true) {
    const { address } = await this.getOutputAccount();
    return this.getBalances(
      (withMain ? [{ address }] : []).concat(
        tokenIds.map((tokenAddress) => ({ address, tokenAddress })),
      ),
    );
  }

  override async validateAddress(address: string): Promise<string> {
    const isValid = confluxAddress.isValidCfxAddress(address);
    const normalizedAddress = isValid ? address.toLowerCase() : undefined;

    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }
    return Promise.resolve(normalizedAddress);
  }

  // Chain only functionalities below.

  async buildEncodedTxAction(encodedTx: IEncodedTxCfx) {
    const { address } = await this.getOutputAccount();
    const client = await this.getClient();
    const crc20 = client.CRC20(encodedTx.to);
    const [actionType, actionDesc] = parseTransaction(encodedTx, crc20);
    const action: IDecodedTxAction = {
      type: IDecodedTxActionType.UNKNOWN,
      direction: await this.buildTxActionDirection({
        from: encodedTx.from,
        to: encodedTx.to,
        address,
      }),
      unknownAction: {
        extraInfo: {},
      },
    };

    let extraNativeTransferAction: IDecodedTxAction | undefined;
    if (encodedTx.value) {
      const valueBn = new BigNumber(encodedTx.value);
      if (!valueBn.isNaN() && valueBn.gt(0)) {
        extraNativeTransferAction = {
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          nativeTransfer: await this.buildNativeTransfer(encodedTx),
        };
      }
    }

    if (actionType === IDecodedTxActionType.NATIVE_TRANSFER) {
      action.type = IDecodedTxActionType.NATIVE_TRANSFER;
      action.nativeTransfer = await this.buildNativeTransfer(encodedTx);
      extraNativeTransferAction = undefined;
    }

    if (actionType === IDecodedTxActionType.TOKEN_TRANSFER) {
      const token = await this.engine.findToken({
        networkId: this.networkId,
        tokenIdOnNetwork: encodedTx.to,
      });

      if (token && actionDesc) {
        const { to, amount } = actionDesc.object;
        const amountBn = new BigNumber(amount);
        action.type = IDecodedTxActionType.TOKEN_TRANSFER;
        action.tokenTransfer = {
          tokenInfo: token,
          from: encodedTx.from ?? address,
          to,
          amount: amountBn.shiftedBy(-token.decimals).toFixed(),
          amountValue: amountBn.toFixed(),
          extraInfo: null,
        };
      }
    }

    return [action, extraNativeTransferAction];
  }

  async buildNativeTransfer(encodedTx: IEncodedTxCfx) {
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);
    const valueBn = new BigNumber(encodedTx.value);
    const network = await this.getNetwork();
    return {
      tokenInfo: nativeToken,
      from: encodedTx.from,
      to: encodedTx.to,
      amount: valueBn.shiftedBy(-network.decimals).toFixed(),
      amountValue: valueBn.toFixed(),
      extraInfo: null,
    };
  }

  override async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    const client = await this.getClient();
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return client.request(request);
    } catch (e) {
      throw extractResponseError(e);
    }
  }

  override createClientFromURL(_url: string): BaseClient {
    throw new NotImplemented();
  }

  fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    return this.engine.providerManager.getTokenInfos(
      this.networkId,
      tokenAddresses,
    );
  }
}
