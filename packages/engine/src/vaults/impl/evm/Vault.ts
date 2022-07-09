/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, no-param-reassign */

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
import { difference, isNil, isNumber, isString, merge, toLower } from 'lodash';
import memoizee from 'memoizee';

import { SendConfirmPayloadInfo } from '@onekeyhq/kit/src/views/Send/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { HISTORY_CONSTS } from '../../../constants';
import simpleDb from '../../../dbs/simple/simpleDb';
import {
  NotImplemented,
  OneKeyInternalError,
  PendingQueueTooLong,
} from '../../../errors';
import * as covalentApi from '../../../managers/covalent';
import { parseCovalentTxToDecodedTx } from '../../../managers/covalent';
import {
  extractResponseError,
  fillUnsignedTx,
  fillUnsignedTxObj,
} from '../../../proxy';
import { DBAccount } from '../../../types/account';
import { ICovalentHistoryListItem } from '../../../types/covalent';
import {
  HistoryEntry,
  HistoryEntryStatus,
  HistoryEntryTransaction,
} from '../../../types/history';
import { ETHMessage, ETHMessageTypes } from '../../../types/message';
import { EIP1559Fee } from '../../../types/network';
import { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionType,
  IDecodedTxInteractInfo,
  IDecodedTxLegacy,
  IDecodedTxStatus,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTokenApprove,
  IEncodedTxUpdatePayloadTransfer,
  IEncodedTxUpdateType,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  IRawTx,
  ISignCredentialOptions,
  ITransferInfo,
} from '../../types';
import { convertFeeValueToGwei } from '../../utils/feeInfoUtils';
import { VaultBase } from '../../VaultBase';

import { Erc20MethodSelectors } from './decoder/abi';
import {
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
import { IRpcTxEvm } from './types';

const OPTIMISM_NETWORKS = ['evm--10', 'evm--69'];

export type IUnsignedMessageEvm = ETHMessage & {
  payload?: any;
};

export type IEncodedTxEvm = {
  from: string;
  to: string;
  value: string;
  data?: string;
  nonce?: number | string; // rpc use 0x string

  gas?: string; // alias for gasLimit
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
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

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    throw new Error('decodedTxToLegacy in EVM not implemented.');
  }

  // TODO rewrite decodeTx EVM
  //    build nativeTransfer action from contractCall with value>0
  override async decodeTx(
    encodedTx: IEncodedTxEvm,
    payload?: any,
  ): Promise<IDecodedTx> {
    const decodedTxLegacy = await this.legacyDecodeTx(encodedTx, payload);
    const decodedTx = await this.decodedTxLegacyToModern({
      decodedTxLegacy,
      encodedTx,
      payload,
    });
    return decodedTx;
  }

  async legacyDecodeTx(
    encodedTx: IEncodedTx,
    payload?: any,
  ): Promise<IDecodedTxLegacy> {
    const ethersTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as ethers.Transaction;

    if (!Number.isFinite(ethersTx.chainId)) {
      ethersTx.chainId = Number(await this.getNetworkChainId());
    }
    return EVMTxDecoder.getDecoder(this.engine).decodeTx({
      vault: this,
      rawTx: ethersTx,
      payload,
    });
  }

  async decodedTxLegacyToModern({
    decodedTxLegacy,
    encodedTx,
    payload,
    interactInfo,
  }: {
    decodedTxLegacy: IDecodedTxLegacy;
    encodedTx: IEncodedTxEvm;
    payload?: SendConfirmPayloadInfo;
    interactInfo?: IDecodedTxInteractInfo;
  }): Promise<IDecodedTx> {
    const address = await this.getAccountAddress();
    const network = await this.getNetwork();
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);
    const action: IDecodedTxAction = {
      type: IDecodedTxActionType.TRANSACTION,
      direction: await this.buildTxActionDirection({
        from: decodedTxLegacy.fromAddress,
        to: decodedTxLegacy.toAddress,
        address,
      }),
      unknownAction: {
        extraInfo: {},
      },
    };
    if (decodedTxLegacy.txType === EVMDecodedTxType.NATIVE_TRANSFER) {
      action.type = IDecodedTxActionType.NATIVE_TRANSFER;
      action.nativeTransfer = {
        tokenInfo: nativeToken,
        from: decodedTxLegacy.fromAddress,
        to: decodedTxLegacy.toAddress,
        amount: decodedTxLegacy.amount,
        amountValue: decodedTxLegacy.value,
        extraInfo: null,
      };
    }
    if (decodedTxLegacy.txType === EVMDecodedTxType.TOKEN_TRANSFER) {
      const info = decodedTxLegacy.info as EVMDecodedItemERC20Transfer;
      action.type = IDecodedTxActionType.TOKEN_TRANSFER;
      action.tokenTransfer = {
        tokenInfo: info.token,
        from: info.from ?? address,
        to: info.recipient,
        amount: info.amount,
        amountValue: info.value,
        extraInfo: null,
      };
    }
    if (decodedTxLegacy.txType === EVMDecodedTxType.TOKEN_APPROVE) {
      const info = decodedTxLegacy.info as EVMDecodedItemERC20Approve;
      action.type = IDecodedTxActionType.TOKEN_APPROVE;
      action.tokenApprove = {
        tokenInfo: info.token,
        owner: encodedTx.from ?? address,
        spender: info.spender,
        amount: info.amount,
        amountValue: info.value,
        isMax: info.isUInt256Max,
        extraInfo: null,
      };
    }
    if (payload?.type === 'InternalSwap' && payload?.swapInfo) {
      action.internalSwap = {
        ...payload.swapInfo,
        extraInfo: null,
      };
      // Only support same chain swap
      if (
        payload.swapInfo.send.networkId === payload.swapInfo.receive.networkId
      ) {
        action.type = IDecodedTxActionType.INTERNAL_SWAP;
      }
    }
    const { gasInfo } = decodedTxLegacy;
    let feeInfo: IFeeInfoUnit;
    const limit = new BigNumber(gasInfo.gasLimit).toFixed();
    if (gasInfo.maxFeePerGas) {
      feeInfo = {
        eip1559: true,
        limit,
        price: {
          // TODO add baseFee in encodedTx
          baseFee: '0',

          // TODO fee decimals convert utils
          maxPriorityFeePerGas: new BigNumber(gasInfo.maxPriorityFeePerGas)
            .shiftedBy(-network.feeDecimals)
            .toFixed(),
          maxPriorityFeePerGasValue: gasInfo.maxPriorityFeePerGas,

          maxFeePerGas: new BigNumber(gasInfo.maxFeePerGas)
            .shiftedBy(-network.feeDecimals)
            .toFixed(),
          maxFeePerGasValue: gasInfo.maxFeePerGas,

          gasPrice: new BigNumber(gasInfo.gasPrice || gasInfo.maxFeePerGas)
            .shiftedBy(-network.feeDecimals)
            .toFixed(),
          gasPriceValue: gasInfo.gasPrice || gasInfo.maxFeePerGas,
        },
      };
    } else {
      feeInfo = {
        limit,
        price: new BigNumber(gasInfo.gasPrice)
          .shiftedBy(-network.feeDecimals)
          .toFixed(),
        priceValue: gasInfo.gasPrice,
      };
    }
    const decodedTx: IDecodedTx = {
      txid: decodedTxLegacy.txHash,
      owner: address,
      signer: decodedTxLegacy.fromAddress,
      nonce: decodedTxLegacy.nonce || 0,
      actions: [action],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      payload,
      feeInfo,
      interactInfo,
      // totalFeeInNative, // runtime calculate fee in UI
      extraInfo: {
        // decodedTxLegacy
      },
    };
    return decodedTx;
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxEvm> {
    const network = await this.getNetwork();
    const isTransferToken = Boolean(transferInfo.token);
    const isTransferNativeToken = !isTransferToken;
    const { amount } = transferInfo;
    let amountBN = new BigNumber(amount);
    if (amountBN.isNaN()) {
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
      this.validateAddress(approveInfo.spender),
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
    encodedTx: IEncodedTxEvm,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxEvm> {
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
  ): Promise<IEncodedTxEvm> {
    const decodedTx = await this.legacyDecodeTx(encodedTx);
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

    const decodedTx = await this.legacyDecodeTx(encodedTx);
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
    const nonceBN = new BigNumber(nonce ?? 'NaN');
    const nextNonce: number = !nonceBN.isNaN()
      ? nonceBN.toNumber()
      : await this.getNextNonce(network.id, dbAccount);
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
        nonce: nextNonce,
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

    // TODO remove side effect here
    encodedTx.nonce = nextNonce;

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

    const network = await this.getNetwork();
    const decodedTx = await this.legacyDecodeTx(encodedTx);
    if (decodedTx.txType === EVMDecodedTxType.NATIVE_TRANSFER) {
      // always use value=0 to calculate native transfer gas limit
      encodedTxWithFakePriceAndNonce.value = '0x0';
    }

    const [prices, unsignedTx] = await Promise.all([
      this.engine.getGasPrice(this.networkId),
      // TODO add options params to control which fields should fetch in blockchain-libs
      this.buildUnsignedTxFromEncodedTx(encodedTxWithFakePriceAndNonce),
    ]);

    // For L2 networks with L1 fee.
    let baseFeeValue = '0';
    if (OPTIMISM_NETWORKS.includes(this.networkId)) {
      // Optimism & Optimism Kovan
      // call gasL1Fee(bytes) of GasPriceOracle at 0x420000000000000000000000000000000000000F
      const txData = ethers.utils.serializeTransaction({
        value: encodedTx.value,
        data: encodedTx.data,
        gasLimit: `0x${(unsignedTx.feeLimit ?? new BigNumber('0')).toString(
          16,
        )}`,
        to: encodedTx.to,
        chainId: 10, // any number other than 0 will lead to fixed length of data
        gasPrice: '0xf4240', // 0.001 Gwei
        nonce: 1,
      });

      // keccak256(Buffer.from('getL1Fee(bytes)')) => '0x49948e0e...'
      const data = `0x49948e0e${defaultAbiCoder
        .encode(['bytes'], [txData])
        .slice(2)}`;
      const client = await this.getJsonRPCClient();
      const l1FeeHex = await client.rpc.call('eth_call', [
        { to: '0x420000000000000000000000000000000000000F', data },
        'latest',
      ]);
      baseFeeValue = new BigNumber(l1FeeHex as string)
        .shiftedBy(-network.feeDecimals)
        .toFixed();
    }

    const eip1559 = Boolean(
      prices?.length && prices?.every((price) => typeof price === 'object'),
    );

    const gasLimitInTx = new BigNumber(
      encodedTx.gas ?? encodedTx.gasLimit ?? 0,
    ).toFixed();
    // NOTE: gasPrice deleted in removeFeeInfoInTx() if encodedTx build by DAPP
    let gasPriceInTx: string | EIP1559Fee | undefined = encodedTx.gasPrice
      ? this._toNormalAmount(encodedTx.gasPrice, network.feeDecimals)
      : undefined;
    if (eip1559) {
      gasPriceInTx = merge(
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
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      eip1559,
      limit,
      prices,
      defaultPresetIndex: '1',

      // feeInfo in original tx
      tx: {
        eip1559,
        limit: gasLimitInTx,
        price: gasPriceInTx,
      },
      baseFeeValue,
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
    const maxPendingNonce =
      (await simpleDb.history.getMaxPendingNonce({
        accountId: this.accountId,
        networkId,
      })) || 0;
    const nextNonce = Math.max(maxPendingNonce + 1, onChainNonce);

    if (nextNonce - onChainNonce >= HISTORY_CONSTS.PENDING_QUEUE_MAX_LENGTH) {
      throw new PendingQueueTooLong(HISTORY_CONSTS.PENDING_QUEUE_MAX_LENGTH);
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
      return (this.engineProvider as EthProvider).mmGetPublicKey(signer);
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
      return (this.engineProvider as EthProvider).mmDecrypt(message, signer);
    }
    throw new NotImplemented('Only software keryings support mm decryption.');
  }

  async personalECRecover(message: string, signature: string): Promise<string> {
    return (this.engineProvider as EthProvider).ecRecover(
      { type: ETHMessageTypes.PERSONAL_SIGN, message },
      signature,
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

  override async getAccountNonce(): Promise<number | null> {
    const nonce = await getTxCount(await this.getAccountAddress(), this);
    return nonce;
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

  // TODO mergeDecodedTx( { decodedTx, encodedTx, historyTx, rawTx }, extraTxMap: { covalentTx })
  //    call at saveSendConfirmHistory
  async mergeDecodedTx({
    decodedTx,
    encodedTx,
    historyTx,
    rawTx,
    // extra tx
    covalentTx,
    rpcReceiptTx,
    isCovalentApiAvailable,
  }: {
    decodedTx: IDecodedTx;
    encodedTx?: IEncodedTx;
    historyTx?: IHistoryTx;
    rawTx?: IRawTx;
    covalentTx?: ICovalentHistoryListItem;
    rpcReceiptTx?: any;
    isCovalentApiAvailable?: boolean;
  }): Promise<IDecodedTx> {
    const network = await this.getNetwork();
    if (historyTx) {
      // update local history tx info to decodedTx
      decodedTx = {
        ...historyTx.decodedTx,
        encodedTx: decodedTx.encodedTx ?? historyTx.decodedTx.encodedTx,
      };
    }
    // TODO parse covalentTx log_events to decodedTx.actions, like tokenTransfer actions
    if (covalentTx) {
      // TODO update time and status by RPC
      //    eth_getBlockByHash timestamp
      //    eth_getTransactionReceipt status
      const blockSignedAt = new Date(covalentTx.block_signed_at).getTime();
      decodedTx.updatedAt = blockSignedAt;
      decodedTx.createdAt = decodedTx.createdAt ?? blockSignedAt;
      decodedTx.status = covalentTx.successful
        ? IDecodedTxStatus.Confirmed
        : IDecodedTxStatus.Failed;
      decodedTx.signer = covalentTx.from_address || decodedTx.signer;
      decodedTx.outputActions =
        covalentTx.parsedDecodedTx?.outputActions || decodedTx.outputActions;
      const priceValue = new BigNumber(covalentTx.gas_price).toFixed();
      const priceGwei = convertFeeValueToGwei({
        value: priceValue,
        network,
      });
      const limit = new BigNumber(covalentTx.gas_offered).toFixed();
      const limitUsed = new BigNumber(covalentTx.gas_spent).toFixed();
      const defaultGasInfo: IFeeInfoUnit = {
        priceValue,
        price: priceGwei,
        limit,
        limitUsed,
      };
      decodedTx.feeInfo = decodedTx.feeInfo || defaultGasInfo;
      if (decodedTx && decodedTx.feeInfo) {
        decodedTx.feeInfo.limitUsed = limitUsed;
        decodedTx.feeInfo.limit = limit;
        if (decodedTx.feeInfo.eip1559) {
          const eip1559Fee = decodedTx.feeInfo.price as EIP1559Fee;
          eip1559Fee.gasPrice = priceGwei;
          eip1559Fee.gasPriceValue = priceValue;
        }
      }
      decodedTx.isFinal = true;
      // TODO update outputActions
      // decodedTx.outputActions
    }
    // fetch by RPC:  eth_getTransactionReceipt
    if (rpcReceiptTx) {
      // TODO update status, limitUsed, updatedAt, isFinal, outputActions, nonce
    }

    // status may be updated by refreshPendingHistory task, so ignore pending here
    if (decodedTx.status !== IDecodedTxStatus.Pending) {
      if (!isCovalentApiAvailable) {
        if (
          decodedTx.createdAt &&
          Date.now() - decodedTx.createdAt >
            HISTORY_CONSTS.SET_IS_FINAL_EXPIRED_IN
        ) {
          decodedTx.isFinal = true;
        }
      }
    }
    return Promise.resolve(decodedTx);
  }

  // TODO add limit here
  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { tokenIdOnNetwork, localHistory = [] } = options;
    const localFinalHashes = localHistory
      .filter((item) => item.decodedTx.isFinal)
      .map((item) => item.decodedTx.txid);
    const chainId = await this.getNetworkChainId();
    const address = await this.getAccountAddress();
    const client = await this.getJsonRPCClient();
    /*
    {
      hash1: { covalentTx, alchemyTx, infStoneTx, explorerTx, rpcTx },
      hash2: { covalentTx, alchemyTx, infStoneTx, explorerTx, rpcTx },
    }

    - fetch hashes
    - filter hashes (not isFinal)
    - parse result
    - merge result
     */

    let hashes: string[] = [];
    let covalentTxList: ICovalentHistoryListItem[] = [];
    let isCovalentApiAvailable = false;
    try {
      // TODO covalentApi, AlchemyApi, InfStoneApi, blockExplorerApi, RPC api
      const covalentHistory = await covalentApi.fetchCovalentHistoryRaw({
        chainId,
        address,
        contract: tokenIdOnNetwork,
      });
      isCovalentApiAvailable = true;
      covalentTxList = covalentHistory.data.items;
      hashes = covalentTxList.map((item) => item.tx_hash);
    } catch (error) {
      console.error(error);
      // fallback localHistory which isLocalCreated to RPC query update gasUsed
      //    if covalentApi if fail or NOT support on this chain
      hashes = localHistory
        .filter((item) => !!item.isLocalCreated)
        .map((item) => item.decodedTx.txid);
    }

    // ignore localHistory isFinal
    hashes = difference(hashes, localFinalHashes);
    hashes = hashes.filter(Boolean);

    /*
   const batchCallParams2 = hashes.map(
      (hash) => ['eth_getTransactionReceipt', [hash]] as [string, string[]],
    );
    // TODO batchCall one by one
    await client.rpc.batchCall(batchCallParams2);
    */

    const batchCallParams = hashes.map(
      // TODO eth_getTransactionByHash eth_getTransactionReceipt
      (hash) => ['eth_getTransactionByHash', [hash]] as [string, string[]],
    );
    let rpcTxList: Array<IRpcTxEvm | null> = [];

    if (batchCallParams.length) {
      try {
        rpcTxList = await client.rpc.batchCall(batchCallParams);
      } catch (error) {
        console.error(error);
      }
    }

    const historyTxList = await Promise.all(
      hashes.map(async (hash, index) => {
        // pending tx rpc return null
        let encodedTx = rpcTxList.find((item) => item?.hash === hash);

        const historyTx = localHistory.find(
          (item) => item.decodedTx.txid === hash,
        );
        if (historyTx?.decodedTx?.isFinal) {
          return null;
        }

        encodedTx =
          encodedTx ||
          (historyTx?.decodedTx?.encodedTx as IEncodedTxEvm | undefined);
        if (encodedTx) {
          encodedTx.data = encodedTx.input;
          // convert 0x string to number, chain-libs need number type
          if (isString(encodedTx.nonce)) {
            encodedTx.nonce = new BigNumber(encodedTx.nonce).toNumber() ?? 0;
          }
        }

        let covalentTx = covalentTxList.find(
          (covalentTxItem) => covalentTxItem.tx_hash === hash,
        );
        if (covalentTx) {
          covalentTx = await covalentApi.parseCovalentTxToDecodedTx({
            covalentTx,
            address,
            vault: this,
            encodedTx,
          });
        }

        let decodedTx: IDecodedTx | undefined;

        decodedTx = covalentTx?.parsedDecodedTx;

        if (encodedTx) {
          // TODO _decode getOrAddToken RPC error
          // TODO encodedTx both transfer Native and Token
          try {
            decodedTx = await this.decodeTx(encodedTx, null);
          } catch (error) {
            console.error(error);
          }
        }

        if (!decodedTx) {
          return null;
        }

        decodedTx = await this.mergeDecodedTx({
          decodedTx,
          encodedTx,
          historyTx,
          covalentTx,
          isCovalentApiAvailable,
        });

        decodedTx.tokenIdOnNetwork = tokenIdOnNetwork;

        // TODO merge decodedTx info from local pending history

        return this.buildHistoryTx({
          decodedTx,
          encodedTx,
          historyTxToMerge: historyTx,
        });
      }),
    );
    return historyTxList.filter(Boolean);
    // TODO batchCall not supported chain, fallback parse covalentTxList to decodedTx
  }

  override fixAddressCase(address: string) {
    // TODO replace `engineUtils.fixAddressCase`
    return Promise.resolve(toLower(address || ''));
  }

  override isContractAddress = memoizee(
    async (address: string): Promise<boolean> => {
      try {
        await this.validateAddress(address);
        const client = await this.getJsonRPCClient();
        return await client.isContract(address);
      } catch {
        return Promise.resolve(false);
      }
    },
    {
      promise: true,
      max: 50,
    },
  );
}
