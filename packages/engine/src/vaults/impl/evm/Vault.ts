/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { defaultAbiCoder } from '@ethersproject/abi';
import { ethers } from '@onekeyfe/blockchain-libs';
import { toBigIntHex } from '@onekeyfe/blockchain-libs/dist/basic/bignumber-plus';
import { Geth } from '@onekeyfe/blockchain-libs/dist/provider/chains/eth/geth';
import { Provider as EthProvider } from '@onekeyfe/blockchain-libs/dist/provider/chains/eth/provider';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import {
  PartialTokenInfo,
  TransactionStatus,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import { isNil, merge } from 'lodash';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  NotImplemented,
  OneKeyInternalError,
  PendingQueueTooLong,
} from '../../../errors';
import {
  extractResponseError,
  fillUnsignedTx,
  fillUnsignedTxObj,
} from '../../../proxy';
import { DBAccount } from '../../../types/account';
import {
  HistoryEntry,
  HistoryEntryStatus,
  HistoryEntryTransaction,
} from '../../../types/history';
import { ETHMessage, ETHMessageTypes } from '../../../types/message';
import { EIP1559Fee, EvmExtraInfo } from '../../../types/network';
import { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTokenApprove,
  IEncodedTxUpdatePayloadTransfer,
  IEncodedTxUpdateType,
  IFeeInfo,
  IFeeInfoUnit,
  ISignCredentialOptions,
  ITransferInfo,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { Erc20MethodSelectors } from './decoder/abi';
import {
  EVMDecodedItem,
  EVMDecodedItemERC20Approve,
  EVMDecodedItemERC20Transfer,
  EVMDecodedTxType,
  EVMTxDecoder,
  InfiniteAmountHex,
  InfiniteAmountText,
} from './decoder/decoder';
import { getTxCount } from './decoder/util';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

const PENDING_QUEUE_MAX_LENGTH = 10;

export type IUnsignedMessageEvm = ETHMessage & {
  payload?: any;
};

export type IEncodedTxEvm = {
  from: string;
  to: string;
  value: string;
  data: string;
  gas?: string; // alias for gasLimit
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
};

export enum IDecodedTxEvmType {
  NativeTransfer = 'NativeTransfer',
  TokenTransfer = 'TokenTransfer',
  TokenApprove = 'TokenApprove',
  Swap = 'Swap',
  NftTransfer = 'NftTransfer',
  Transaction = 'Transaction',
  ContractDeploy = 'ContractDeploy',
}

function decodeUnsignedTxFeeData(unsignedTx: UnsignedTx) {
  return {
    feeLimit: unsignedTx.feeLimit?.toFixed(),
    feePricePerUnit: unsignedTx.feePricePerUnit?.toFixed(),
    maxPriorityFeePerGas:
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      unsignedTx.payload?.maxPriorityFeePerGas?.toFixed(),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    maxFeePerGas: unsignedTx.payload?.maxFeePerGas?.toFixed(),
  };
}

export default class Vault extends VaultBase {
  settings = settings;

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

  private async getJsonRPCClient(): Promise<Geth> {
    return (await this.engine.providerManager.getClient(
      this.networkId,
    )) as Geth;
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
    debugLogger.engine('EVM simpleTransfer', payload);
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
    // TODO buildUnsignedTx
    const unsignedTx = await this.engine.providerManager.buildUnsignedTx(
      networkId,
      fillUnsignedTx(network, dbAccount, to, valueBN, token, extraCombined),
    );
    return this.signAndSendTransaction(unsignedTx, options);
  }

  // @ts-ignore
  decodedTxToLegacy(decodedTx: IDecodedTxLegacy): Promise<IDecodedTxLegacy> {
    return Promise.resolve(decodedTx);
  }

  // @ts-ignore
  override async decodeTx(
    encodedTx: IEncodedTx,
    payload?: any,
  ): Promise<IDecodedTxLegacy> {
    const ethersTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as ethers.Transaction;

    if (!Number.isFinite(ethersTx.chainId)) {
      ethersTx.chainId = Number(await this.getNetworkChainId());
    }
    return EVMTxDecoder.getDecoder(this.engine).decode(ethersTx, payload);
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxEvm> {
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

    // erc20 token transfer
    if (isTransferToken) {
      const token = await this.engine.getOrAddToken(
        this.networkId,
        transferInfo.token ?? '',
        true,
      );
      if (!token) {
        throw new Error(`Token not found: ${transferInfo.token as string}`);
      }
      const amountHex = toBigIntHex(amountBN.shiftedBy(token.decimals));

      const data = `${Erc20MethodSelectors.tokenTransfer}${defaultAbiCoder
        .encode(['address', 'uint256'], [transferInfo.to, amountHex])
        .slice(2)}`; // method_selector(transfer) + byte32_pad(address) + byte32_pad(value)
      // erc20 token transfer
      return {
        from: transferInfo.from,
        to: transferInfo.token ?? '',
        value: '0x0',
        data,
      };
    }

    // native token transfer
    const amountHex = toBigIntHex(amountBN.shiftedBy(network.decimals));
    return {
      from: transferInfo.from,
      to: transferInfo.to,
      value: amountHex,
      data: '0x',
    };
  }

  async buildEncodedTxFromApprove(
    approveInfo: IApproveInfo,
  ): Promise<IEncodedTxEvm> {
    const [network, token, spender] = await Promise.all([
      this.getNetwork(),
      this.engine.getOrAddToken(this.networkId, approveInfo.token),
      this.engine.validator.validateAddress(
        this.networkId,
        approveInfo.spender,
      ),
    ]);
    if (typeof token === 'undefined') {
      throw new Error(`Token not found: ${approveInfo.token}`);
    }

    const amountBN = new BigNumber(approveInfo.amount);
    const amountHex = toBigIntHex(
      amountBN.isNaN()
        ? new BigNumber(2).pow(256).minus(1)
        : amountBN.shiftedBy(token.decimals),
    );
    // keccak256(Buffer.from('approve(address,uint256)') => '0x095ea7b3...'
    const methodID = Erc20MethodSelectors.tokenApprove;
    const data = `${methodID}${defaultAbiCoder
      .encode(['address', 'uint256'], [spender, amountHex])
      .slice(2)}`;
    return {
      from: approveInfo.from,
      to: approveInfo.token,
      value: '0x0',
      data,
    };
  }

  async updateEncodedTx(
    encodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    if (options.type === IEncodedTxUpdateType.tokenApprove) {
      const p = payload as IEncodedTxUpdatePayloadTokenApprove;
      return this.updateEncodedTxTokenApprove(encodedTx, p.amount);
    }
    if (options.type === IEncodedTxUpdateType.transfer) {
      return this.updateEncodedTxTransfer(encodedTx, payload);
    }
    return Promise.resolve(encodedTx);
  }

  async updateEncodedTxTransfer(
    encodedTx: IEncodedTxEvm,
    payload: IEncodedTxUpdatePayloadTransfer,
  ): Promise<IEncodedTx> {
    const decodedTx = await this.decodeTx(encodedTx);
    const { amount } = payload;
    const amountBN = new BigNumber(amount);
    if (decodedTx.txType === EVMDecodedTxType.NATIVE_TRANSFER) {
      const network = await this.getNetwork();
      encodedTx.value = toBigIntHex(amountBN.shiftedBy(network.decimals));
    }
    if (decodedTx.txType === EVMDecodedTxType.TOKEN_TRANSFER) {
      const info = decodedTx.info as EVMDecodedItemERC20Transfer;
      const amountHex = toBigIntHex(amountBN.shiftedBy(info.token.decimals));
      const data = `${Erc20MethodSelectors.tokenTransfer}${defaultAbiCoder
        .encode(['address', 'uint256'], [info.recipient, amountHex])
        .slice(2)}`;
      encodedTx.data = data;
    }
    return encodedTx;
  }

  async updateEncodedTxTokenApprove(
    encodedTx: IEncodedTxEvm,
    amount: string,
  ): Promise<IEncodedTxEvm> {
    // keccak256(Buffer.from('approve(address,uint256)') => '0x095ea7b3...'
    const approveMethodID = Erc20MethodSelectors.tokenApprove;

    const decodedTx = await this.decodeTx(encodedTx);
    if (decodedTx.txType !== EVMDecodedTxType.TOKEN_APPROVE) {
      throw new Error('Not a approve transaction.');
    }

    const { token, spender } = decodedTx.info as EVMDecodedItemERC20Approve;
    let amountHex;
    if (amount === InfiniteAmountText || amount === InfiniteAmountHex) {
      amountHex = InfiniteAmountHex;
    } else {
      const amountBN = new BigNumber(amount);
      if (amountBN.isNaN()) {
        throw new Error(`Invalid amount input: ${amount}`);
      }
      amountHex = toBigIntHex(amountBN.shiftedBy(token.decimals));
    }

    const data = `${approveMethodID}${defaultAbiCoder
      .encode(['address', 'uint256'], [spender, amountHex])
      .slice(2)}`;
    return {
      ...encodedTx,
      data, // Override the data
    };
  }

  async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxEvm,
    // TODO feeInfo
  ): Promise<UnsignedTx> {
    const network = await this.getNetwork();
    const dbAccount = await this.getDbAccount();
    const {
      to,
      value,
      data,
      gas,
      gasLimit,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce,
      ...others
    } = encodedTx;
    debugLogger.sendTx(
      'buildUnsignedTxFromEncodedTx >>>> encodedTx',
      encodedTx,
    );
    const gasLimitFinal = gasLimit ?? gas;
    // fillUnsignedTx in each impl
    const unsignedTxInfo = fillUnsignedTxObj({
      shiftFeeDecimals: false,
      network,
      dbAccount,
      to,
      valueOnChain: value,
      extra: {
        data,
        feeLimit: !isNil(gasLimitFinal)
          ? new BigNumber(gasLimitFinal)
          : undefined,
        feePricePerUnit: !isNil(gasPrice) ? new BigNumber(gasPrice) : undefined,
        maxFeePerGas,
        maxPriorityFeePerGas,
        nonce:
          typeof nonce !== 'undefined'
            ? nonce
            : await this.getNextNonce(network.id, dbAccount),
        ...others,
      },
    });

    debugLogger.sendTx(
      'buildUnsignedTxFromEncodedTx >>>> fillUnsignedTx',
      unsignedTxInfo,
      decodeUnsignedTxFeeData(unsignedTxInfo),
    );

    const unsignedTx = await this.engine.providerManager.buildUnsignedTx(
      this.networkId,
      unsignedTxInfo,
    );

    debugLogger.sendTx(
      'buildUnsignedTxFromEncodedTx >>>> buildUnsignedTx',
      unsignedTx,
      decodeUnsignedTxFeeData(unsignedTx),
    );

    return unsignedTx;
  }

  _toNormalAmount(value: string, decimals: number) {
    const valueBN = ethers.BigNumber.from(value);
    return ethers.utils.formatUnits(valueBN, decimals);
  }

  async fetchFeeInfo(encodedTx: IEncodedTxEvm): Promise<IFeeInfo> {
    // NOTE: for fetching gas limit, we don't want blockchain-libs to fetch
    // other info such as gas price and nonce. Therefore the hack here to
    // avoid redundant network requests.
    // And extract gas & gasLimit to ensure always getting estimated gasLimit
    // from blockchain.
    const { gas, gasLimit, ...encodedTxWithFakePriceAndNonce } = {
      ...encodedTx,
      nonce: 1,
      gasPrice: '1',
    };

    // NOTE: gasPrice deleted in removeFeeInfoInTx() if encodedTx build by DAPP

    const [network, prices, unsignedTx] = await Promise.all([
      this.getNetwork(),
      this.engine.getGasPrice(this.networkId),
      // TODO add options params to control which fields should fetch in blockchain-libs
      this.buildUnsignedTxFromEncodedTx(encodedTxWithFakePriceAndNonce),
    ]);

    const eip1559 = Boolean(
      prices?.length && prices?.every((price) => typeof price === 'object'),
    );
    let priceInfo: string | EIP1559Fee | undefined = encodedTx.gasPrice
      ? this._toNormalAmount(encodedTx.gasPrice, network.feeDecimals)
      : undefined;
    if (eip1559) {
      priceInfo = merge(
        {
          ...(prices[0] as EIP1559Fee),
        },
        {
          maxPriorityFeePerGas: encodedTx.maxPriorityFeePerGas
            ? this._toNormalAmount(
                encodedTx.maxPriorityFeePerGas,
                network.feeDecimals,
              )
            : undefined,
          maxFeePerGas: encodedTx.maxFeePerGas
            ? this._toNormalAmount(encodedTx.maxFeePerGas, network.feeDecimals)
            : undefined,
        },
      ) as EIP1559Fee;
    }
    // [{baseFee: '928.361757873', maxPriorityFeePerGas: '11.36366', maxFeePerGas: '939.725417873'}]
    // [10]
    const limit = BigNumber.max(
      unsignedTx.feeLimit ?? '0',
      gas ?? '0',
      gasLimit ?? '0',
    ).toFixed();

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      symbol: network.feeSymbol,
      decimals: network.feeDecimals, // TODO balance2FeeDecimals

      eip1559,
      limit,
      prices,

      // feeInfo in original tx
      tx: {
        eip1559,
        limit: encodedTx.gas ?? encodedTx.gasLimit,
        price: priceInfo,
      },
    };
  }

  async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxEvm;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxEvm> {
    const network = await this.getNetwork();
    const { encodedTx, feeInfoValue } = params;
    const encodedTxWithFee = { ...encodedTx };
    if (!isNil(feeInfoValue.limit)) {
      encodedTxWithFee.gas = toBigIntHex(new BigNumber(feeInfoValue.limit));
      encodedTxWithFee.gasLimit = toBigIntHex(
        new BigNumber(feeInfoValue.limit),
      );
    }
    // TODO to hex and shift decimals, do not shift decimals in fillUnsignedTxObj
    if (!isNil(feeInfoValue.price)) {
      if (feeInfoValue.eip1559) {
        const priceInfo = feeInfoValue.price as EIP1559Fee;
        encodedTxWithFee.maxFeePerGas = toBigIntHex(
          new BigNumber(priceInfo.maxFeePerGas).shiftedBy(network.feeDecimals),
        );
        encodedTxWithFee.maxPriorityFeePerGas = toBigIntHex(
          new BigNumber(priceInfo.maxPriorityFeePerGas).shiftedBy(
            network.feeDecimals,
          ),
        );
        delete encodedTxWithFee.gasPrice;
      } else {
        encodedTxWithFee.gasPrice = toBigIntHex(
          new BigNumber(feeInfoValue.price as string).shiftedBy(
            network.feeDecimals,
          ),
        );
      }
    }
    return Promise.resolve(encodedTxWithFee);
  }

  private async getNextNonce(
    networkId: string,
    dbAccount: DBAccount,
  ): Promise<number> {
    const onChainNonce =
      (
        await this.engine.providerManager.getAddresses(networkId, [
          dbAccount.address,
        ])
      )[0]?.nonce ?? 0;

    // TODO: Although 100 history items should be enough to cover all the
    // pending transactions, we need to find a more reliable way.
    const historyItems = await this.engine.getHistory(
      networkId,
      dbAccount.id,
      undefined,
      false,
    );
    const nextNonce = Math.max(
      ...(await Promise.all(
        historyItems
          .filter((entry) => entry.status === HistoryEntryStatus.PENDING)
          .map((historyItem) =>
            EVMTxDecoder.getDecoder(this.engine)
              .decode((historyItem as HistoryEntryTransaction).rawTx)
              .then(({ nonce }) => (nonce ?? 0) + 1),
          ),
      )),
      onChainNonce,
    );

    if (nextNonce - onChainNonce >= PENDING_QUEUE_MAX_LENGTH) {
      throw new PendingQueueTooLong(PENDING_QUEUE_MAX_LENGTH);
    }

    return nextNonce;
  }

  async mmGetPublicKey(options: ISignCredentialOptions): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const { password } = options;
      if (typeof password === 'undefined') {
        throw new OneKeyInternalError('password required');
      }
      const { [dbAccount.address]: signer } = await keyring.getSigners(
        password,
        [dbAccount.address],
      );
      return this.engine.providerManager
        .getProvider(this.networkId)
        .then((provider) => (provider as EthProvider).mmGetPublicKey(signer));
    }
    throw new NotImplemented(
      'Only software keryings support getting encryption key.',
    );
  }

  async mmDecrypt(
    message: string,
    options: ISignCredentialOptions,
  ): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const { password } = options;
      if (typeof password === 'undefined') {
        throw new OneKeyInternalError('password required');
      }
      const { [dbAccount.address]: signer } = await keyring.getSigners(
        password,
        [dbAccount.address],
      );
      return this.engine.providerManager
        .getProvider(this.networkId)
        .then((provider) =>
          (provider as EthProvider).mmDecrypt(message, signer),
        );
    }
    throw new NotImplemented('Only software keryings support mm decryption.');
  }

  async personalECRecover(message: string, signature: string): Promise<string> {
    return this.engine.providerManager
      .getProvider(this.networkId)
      .then((provider) =>
        (provider as EthProvider).ecRecover(
          { type: ETHMessageTypes.PERSONAL_SIGN, message },
          signature,
        ),
      );
  }

  override async getTokenAllowance(
    tokenAddress: string,
    spenderAddress: string,
  ): Promise<BigNumber> {
    const [dbAccount, token] = await Promise.all([
      this.getDbAccount(),
      this.engine.getOrAddToken(this.networkId, tokenAddress),
    ]);

    if (typeof token === 'undefined') {
      // This will be catched by engine.
      console.error(`Token not found: ${tokenAddress}`);
      throw new Error();
    }

    // keccak256(Buffer.from('allowance(address,address)') => '0xdd62ed3e...'
    const allowanceMethodID = '0xdd62ed3e';
    const data = `${allowanceMethodID}${defaultAbiCoder
      .encode(['address', 'address'], [dbAccount.address, spenderAddress])
      .slice(2)}`;
    const client = await this.getJsonRPCClient();
    const rawAllowanceHex = await client.rpc.call('eth_call', [
      { to: token.tokenIdOnNetwork, data },
      'latest',
    ]);
    return new BigNumber(rawAllowanceHex as string).shiftedBy(-token.decimals);
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

  createClientFromURL(url: string): Geth {
    return new Geth(url);
  }

  fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    return this.engine.providerManager.getTokenInfos(
      this.networkId,
      tokenAddresses,
    );
  }

  override async updatePendingTxs(histories: Array<HistoryEntry>) {
    const decoder = EVMTxDecoder.getDecoder(this.engine);
    const decodedPendings = histories
      .filter<HistoryEntryTransaction>(
        (h): h is HistoryEntryTransaction => 'rawTx' in h,
      )
      .filter((h) => h.status === HistoryEntryStatus.PENDING)
      .map(async (h) => ({
        entry: h,
        decodedItem: await decoder.decodeHistoryEntry(h),
      }));

    if (!decodedPendings.length) {
      return {};
    }

    const pendings = await Promise.all(decodedPendings);

    const updatedStatuses =
      await this.engine.providerManager.getTransactionStatuses(
        this.networkId,
        pendings.map(({ decodedItem }) => decodedItem.txHash),
      );

    // TODO: handle different addresses.
    const {
      decodedItem: { fromAddress },
    } = pendings[0];
    const nonce = await getTxCount(fromAddress, this);

    const updatedStatusMap: Record<string, HistoryEntryStatus> = {};
    updatedStatuses.forEach((status, index) => {
      const { entry, decodedItem } = pendings[index];
      const { id } = entry;
      const txNonce = decodedItem.nonce;
      if (
        status === TransactionStatus.NOT_FOUND ||
        status === TransactionStatus.INVALID
      ) {
        if (!isNil(txNonce) && txNonce < nonce) {
          updatedStatusMap[id] = HistoryEntryStatus.DROPPED;
        }
      } else if (status === TransactionStatus.CONFIRM_AND_SUCCESS) {
        updatedStatusMap[id] = HistoryEntryStatus.SUCCESS;
      } else if (status === TransactionStatus.CONFIRM_BUT_FAILED) {
        updatedStatusMap[id] = HistoryEntryStatus.FAILED;
      }
    });

    if (Object.keys(updatedStatusMap).length > 0) {
      await this.engine.dbApi.updateHistoryEntryStatuses(updatedStatusMap);
    }

    return updatedStatusMap;
  }
}
