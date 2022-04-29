/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { defaultAbiCoder } from '@ethersproject/abi';
import { ethers } from '@onekeyfe/blockchain-libs';
import { toBigIntHex } from '@onekeyfe/blockchain-libs/dist/basic/bignumber-plus';
import { Provider as EthProvider } from '@onekeyfe/blockchain-libs/dist/provider/chains/eth/provider';
import { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';
import BigNumber from 'bignumber.js';
import { isNil, merge } from 'lodash';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { NotImplemented, PendingQueueTooLong } from '../../../errors';
import { fillUnsignedTx, fillUnsignedTxObj } from '../../../proxy';
import { DBAccount } from '../../../types/account';
import {
  HistoryEntryStatus,
  HistoryEntryTransaction,
} from '../../../types/history';
import { ETHMessage, ETHMessageTypes } from '../../../types/message';
import { EIP1559Fee, EvmExtraInfo } from '../../../types/network';
import {
  IApproveInfo,
  IEncodedTxAny,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTokenApprove,
  IEncodedTxUpdatePayloadTransfer,
  IEncodedTxUpdateType,
  IFeeInfo,
  IFeeInfoUnit,
  ISignCredentialOptions,
  ITransferInfo,
} from '../../../types/vault';
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
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';

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

  override async decodeTx(encodedTx: IEncodedTxAny): Promise<EVMDecodedItem> {
    const ethersTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as ethers.Transaction;

    if (!Number.isFinite(ethersTx.chainId)) {
      ethersTx.chainId = Number(await this.getNetworkChainId());
    }
    return EVMTxDecoder.getDecoder(this.engine).decode(ethersTx);
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
    encodedTx: IEncodedTxAny,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxAny> {
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
  ): Promise<IEncodedTxAny> {
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
    const encodedTxWithFakePriceAndNonce = {
      ...encodedTx,
      nonce: 1,
      gasPrice: '1',
    };
    const [network, prices, unsignedTx] = await Promise.all([
      this.getNetwork(),
      this.engine.getGasPrice(this.networkId),
      this.buildUnsignedTxFromEncodedTx(encodedTxWithFakePriceAndNonce),
    ]);

    const eip1559 = Boolean(
      prices?.length && prices?.every((gas) => typeof gas === 'object'),
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
    const limit = unsignedTx.feeLimit?.toFixed();

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      symbol: network.feeSymbol,
      decimals: network.feeDecimals, // TODO balance2FeeDecimals
      limit,
      prices,
      eip1559,
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
        encodedTxWithFee.gasPrice = '0x1'; // default gasPrice required in engine api
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

  private async getSigners(options: ISignCredentialOptions) {
    // TODO: this can be moved into keyrings.
    const dbAccount = await this.getDbAccount();
    const credential = await this.keyring.getCredential(options);
    await this.engine.providerManager.getProvider(this.networkId);
    return this.engine.providerManager.getSigners(
      this.networkId,
      credential,
      dbAccount,
    );
  }

  async mmGetPublicKey(options: ISignCredentialOptions): Promise<string> {
    const [signer] = Object.values(await this.getSigners(options));
    return this.engine.providerManager
      .getProvider(this.networkId)
      .then((provider) => (provider as EthProvider).mmGetPublicKey(signer));
  }

  async mmDecrypt(
    message: string,
    options: ISignCredentialOptions,
  ): Promise<string> {
    const [signer] = Object.values(await this.getSigners(options));
    return this.engine.providerManager
      .getProvider(this.networkId)
      .then((provider) => (provider as EthProvider).mmDecrypt(message, signer));
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
}
