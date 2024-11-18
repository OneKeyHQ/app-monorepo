/* eslint-disable @typescript-eslint/no-unused-vars */
import { BI } from '@ckb-lumos/bi';
import { CellCollector, TerminableCellAdapter } from '@ckb-lumos/ckb-indexer';
import { common, secp256k1Blake160 } from '@ckb-lumos/common-scripts';
import {
  TransactionSkeleton,
  minimalCellCapacityCompatible,
} from '@ckb-lumos/helpers';
import { RPC } from '@ckb-lumos/rpc';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import {
  getConfig,
  scriptToAddress,
} from '@onekeyhq/core/src/chains/ckb/sdkCkb';
import type { IEncodedTxCkb } from '@onekeyhq/core/src/chains/ckb/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  MinimumTransferAmountError,
  OneKeyInternalError,
  RemainingMinBalanceError,
} from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type {
  IMeasureRpcStatusParams,
  IMeasureRpcStatusResult,
} from '@onekeyhq/shared/types/customRpc';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import {
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import ClientCkb from './sdkCkb/ClientCkb';
import { isValidateAddress } from './utils/address';
import { decodeBalanceWithCell, decodeNaiveBalance } from './utils/balance';
import { convertTokenHistoryUtxos } from './utils/history';
import {
  DEFAULT_MIN_INPUT_CAPACITY,
  convertRawTxToApiTransaction,
  convertTxSkeletonToTransaction,
  convertTxToTxSkeleton,
  getTransactionSizeByTxSkeleton,
} from './utils/transaction';
import { transfer as xUDTTransafer } from './utils/xudt';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionByCustomRpcParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';
import type { Cell } from '@ckb-lumos/base';
import type { CKBIndexerQueryOptions } from '@ckb-lumos/ckb-indexer/src/type';
import type { Config } from '@ckb-lumos/config-manager';
import type { TransactionSkeletonType } from '@ckb-lumos/helpers';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.ckb.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  async getClient() {
    return this.getClientCache();
  }

  private getClientCache = memoizee(
    async () =>
      new ClientCkb({
        backgroundApi: this.backgroundApi,
        networkId: this.networkId,
      }),
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  getIndexer = memoizee(
    async () => {
      const client = await this.getClient();
      const indexer = new TerminableCellAdapter({
        getCells: client.getCells.bind(client),
      });
      return indexer;
    },
    {
      promise: true,
      max: 1,
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  async _getCurrentConfig() {
    return getConfig(await this.getNetworkChainId());
  }

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;

    const address = account.address || '';

    const { normalizedAddress, displayAddress, isValid } =
      await this.validateAddress(address);
    return {
      networkId,
      normalizedAddress,
      displayAddress,
      address: displayAddress,
      baseAddress: normalizedAddress,
      isValid,
      allowEmptyAddress: false,
    };
  }

  override buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxCkb> {
    const { transfersInfo, specifiedFeeRate } = params;
    if (transfersInfo && !isEmpty(transfersInfo)) {
      if (transfersInfo.length === 1) {
        return this._buildEncodedTxFromTransfer({
          transferInfo: transfersInfo[0],
          specifiedFeeRate,
        });
      }
      throw new OneKeyInternalError('Batch transfers not supported');
    }
    throw new OneKeyInternalError();
  }

  async _buildEncodedTxFromTransfer({
    transferInfo,
    specifiedFeeRate,
  }: {
    transferInfo: ITransferInfo;
    specifiedFeeRate?: string;
  }) {
    const { tokenInfo, amount, from, to } = transferInfo;

    if (!transferInfo.to) {
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }

    if (!tokenInfo) {
      throw new Error(
        'buildEncodedTx ERROR: transferInfo.tokenInfo is missing',
      );
    }

    const client = await this.getClient();
    const indexer = await this.getIndexer();
    const accountAddress = await this.getAccountAddress();
    const network = await this.getNetwork();

    let feeRate = '';
    if (!isNil(specifiedFeeRate)) {
      feeRate = specifiedFeeRate;
    } else {
      const { median } = await client.getFeeRateStatistics();
      feeRate = median;
    }

    let txSkeleton: TransactionSkeletonType = TransactionSkeleton({
      cellProvider: {
        collector: (query) => {
          const queries = { type: 'empty', data: '0x', ...query };
          const cellCollector = new CellCollector(
            indexer,
            queries as CKBIndexerQueryOptions,
          );

          return cellCollector;
        },
      },
    });

    let amountValue;

    if (tokenInfo.isNative) {
      amountValue = new BigNumber(amount)
        .shiftedBy(tokenInfo.decimals)
        .toFixed();

      if (BI.from(amountValue).lt(DEFAULT_MIN_INPUT_CAPACITY)) {
        throw new MinimumTransferAmountError({ info: { amount: '61' } });
      }

      // native transfer
      txSkeleton = await secp256k1Blake160.transferCompatible(
        txSkeleton,
        from ?? accountAddress,
        to,
        BI.from(amountValue),
      );
    } else {
      if (!tokenInfo.address) {
        throw new Error('buildEncodedTx ERROR: tokenInfo.address is missing');
      }
      amountValue = new BigNumber(amount)
        .shiftedBy(tokenInfo.decimals)
        .toFixed();
      // token transfer
      // support XUDT
      txSkeleton = await xUDTTransafer(
        txSkeleton,
        from,
        tokenInfo,
        tokenInfo.address,
        to,
        BI.from(amountValue),
      );
    }

    try {
      const config = await this._getCurrentConfig();
      txSkeleton = await common.payFeeByFeeRate(
        txSkeleton,
        [from],
        feeRate,
        undefined,
        {
          config,
        },
      );
    } catch (err) {
      // ignore
      const outputs = txSkeleton.get('outputs').toArray();
      const lastIndex = outputs.length - 1;
      const lastOutput = outputs[lastIndex];

      // check if the last output is less than the minimal cell capacity
      if (
        lastOutput &&
        BI.from(lastOutput.cellOutput.capacity).lt(
          minimalCellCapacityCompatible(lastOutput),
        )
      ) {
        const miniAmount = new BigNumber(
          minimalCellCapacityCompatible(lastOutput).toString(),
        )
          .shiftedBy(-network.decimals)
          .toFixed();
        throw new RemainingMinBalanceError({
          info: {
            miniAmount,
          },
        });
      }
    }

    // remove empty witness
    txSkeleton = txSkeleton.update('witnesses', (witnesses) =>
      witnesses.filter((witness) => witness !== '0x'),
    );

    const allInputAmount = txSkeleton
      .get('inputs')
      .toArray()
      .reduce(
        (acc, cur) => acc.plus(new BigNumber(cur.cellOutput.capacity, 16)),
        new BigNumber(0),
      );
    const allOutputAmount = txSkeleton
      .get('outputs')
      .toArray()
      .reduce(
        (acc, cur) => acc.plus(new BigNumber(cur.cellOutput.capacity, 16)),
        new BigNumber(0),
      );

    let limit = allInputAmount.minus(allOutputAmount).toString();
    const size = getTransactionSizeByTxSkeleton(txSkeleton);

    if (allInputAmount.isLessThanOrEqualTo(allOutputAmount)) {
      // fix max send fee
      limit = new BigNumber(feeRate).multipliedBy(size).div(1000).toFixed(0);

      console.log('fix max send fee,', {
        limit,
        txSkeleton: txSkeleton.toJSON(),
      });

      txSkeleton = txSkeleton.update('outputs', (outputs) =>
        outputs.update(outputs.size - 1, (output: Cell | undefined) => {
          if (!output) {
            return output;
          }
          output.cellOutput.capacity = BI.from(output.cellOutput.capacity)
            .sub(limit)
            .toHexString();
          return output;
        }),
      );
    }

    const tx = convertTxSkeletonToTransaction(txSkeleton);

    return {
      tx,
      txSize: size,
      feeInfo: {
        limit,
        price: '1',
        feeRate,
      },
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxCkb;

    const client = await this.getClient();
    const txs = await convertTxToTxSkeleton({
      client,
      transaction: encodedTx.tx,
    });

    const inputs = txs.get('inputs').toArray();
    const outputs = txs.get('outputs').toArray();

    const config = await this._getCurrentConfig();
    const network = await this.getNetwork();
    const accountAddress = await this.getAccountAddress();

    const toAddressOutput =
      outputs.find(
        (output) =>
          scriptToAddress(output.cellOutput.lock, { config }) !==
          accountAddress,
      ) ?? outputs[0];

    if (!toAddressOutput) {
      throw new OneKeyInternalError('No to address output found');
    }

    const toAddress = scriptToAddress(toAddressOutput.cellOutput.lock, {
      config,
    });

    let transfers: IDecodedTxTransferInfo[] = [];

    const nativeToken = await this.backgroundApi.serviceToken.getNativeToken({
      networkId: this.networkId,
      accountId: this.accountId,
    });

    if (nativeToken) {
      const transfer = {
        from: accountAddress,
        to: toAddress,
        amount: decodeNaiveBalance(toAddressOutput)
          .shiftedBy(-nativeToken.decimals)
          .toFixed(),
        tokenIdOnNetwork: nativeToken.address,
        icon: nativeToken.logoURI ?? '',
        name: nativeToken.name,
        symbol: nativeToken.symbol,
        isNFT: false,
        isNative: true,
      };

      transfers.push(transfer);
    }

    const tokens = inputs.reduce((acc, cur) => {
      const tokenAddress = cur.cellOutput.type?.args;
      if (tokenAddress) {
        return acc.add(tokenAddress);
      }
      return acc;
    }, new Set<string>());

    let existsToken = false;
    for (const tokenAddress of tokens) {
      const tokenTransfers = await this._decodeTokenTransfers({
        txSkeleton: txs,
        config,
        tokenAddress,
      });
      transfers = [...transfers, ...tokenTransfers];
      if (tokenTransfers.length > 0) {
        existsToken = true;
      }
    }

    if (existsToken && transfers.length > 1) {
      const transfer = transfers[0];
      const isNativeToken = transfer.isNative;

      const isZero = new BigNumber(transfer.amount ?? '0').isLessThanOrEqualTo(
        '0',
      );

      if (isNativeToken && isZero) {
        transfers = transfers.slice(1);
      }
    }

    const totalInput = inputs.reduce(
      (acc, cur) =>
        acc.plus(
          decodeBalanceWithCell(cur, config).shiftedBy(-network.decimals),
        ),
      new BigNumber(0),
    );
    const totalOutput = outputs.reduce(
      (acc, cur) =>
        acc.plus(
          decodeBalanceWithCell(cur, config).shiftedBy(-network.decimals),
        ),
      new BigNumber(0),
    );

    const fee = totalInput.minus(totalOutput).toFixed();

    const action = await this.buildTxTransferAssetAction({
      from: accountAddress,
      to: toAddress,
      transfers,
    });

    return {
      txid: '',
      owner: accountAddress,
      signer: accountAddress,
      nonce: 0,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      totalFeeInNative: fee,
    };
  }

  async _decodeTokenTransfers({
    txSkeleton,
    config,
    tokenAddress,
  }: {
    txSkeleton: TransactionSkeletonType;
    config: Config;
    tokenAddress: string;
  }) {
    const accountAddress = await this.getAccountAddress();

    const token = await this.backgroundApi.serviceToken.getToken({
      networkId: this.networkId,
      accountId: this.accountId,
      tokenIdOnNetwork: tokenAddress,
    });

    if (!token) return [];

    const inputs = txSkeleton
      .get('inputs')
      .toArray()
      .filter(
        (input) =>
          input.cellOutput.type?.args.toLowerCase() ===
          tokenAddress.toLowerCase(),
      );

    const outputs = txSkeleton
      .get('outputs')
      .toArray()
      .filter(
        (input) =>
          input.cellOutput.type?.args.toLowerCase() ===
          tokenAddress.toLowerCase(),
      );

    const utxoFrom = convertTokenHistoryUtxos(
      Array.from(inputs),
      accountAddress,
      token,
      config,
    );
    const utxoTo = convertTokenHistoryUtxos(
      Array.from(outputs),
      accountAddress,
      token,
      config,
    );

    const inputWithMine = utxoFrom.find((input) => input.isMine);

    const utxoToWithoutMine = utxoTo.filter((output) => !output.isMine);
    const utxoToWithMine = utxoTo.filter((output) => output.isMine);

    let direction: EDecodedTxDirection;
    let from = accountAddress;
    let to = accountAddress;
    let amount = '0';
    let amountValue = '0';

    if (inputWithMine) {
      direction = EDecodedTxDirection.OUT;
      const res = utxoTo.find((output) => !output.isMine);
      to = res ? res.address : accountAddress;
      amountValue = utxoToWithoutMine
        .filter((utxo) => utxo.address === to)
        .reduce((acc, cur) => acc.plus(cur.balanceValue), new BigNumber(0))
        .toFixed();
      amount = new BigNumber(amountValue).shiftedBy(-token.decimals).toFixed();
    } else {
      direction = EDecodedTxDirection.IN;
      const res = utxoFrom.find((output) => !output.isMine);
      from = res ? res.address : accountAddress;
      amountValue = utxoToWithMine
        .reduce((acc, cur) => acc.plus(cur.balanceValue), new BigNumber(0))
        .toFixed();
      amount = new BigNumber(amountValue).shiftedBy(-token.decimals).toFixed();
    }

    let transfers: IDecodedTxTransferInfo[] = [];

    if (utxoToWithoutMine && utxoToWithoutMine.length) {
      const outputTo =
        direction === EDecodedTxDirection.OUT
          ? utxoToWithoutMine
          : utxoToWithMine;

      transfers = outputTo.map((utxo) => ({
        from,
        to: utxo.address,
        tokenIdOnNetwork: token.address,
        icon: token.logoURI ?? '',
        name: token.name,
        symbol: token.symbol,
        amount,
        isNFT: false,
        isNative: false,
      }));
    } else {
      transfers = [
        {
          from,
          to,
          tokenIdOnNetwork: token.address,
          icon: token.logoURI ?? '',
          name: token.name,
          symbol: token.symbol,
          amount,
          isNFT: false,
          isNative: true,
        },
      ];
    }

    return transfers;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx({
        encodedTx: encodedTx as IEncodedTxCkb,
        transfersInfo: params.transfersInfo ?? [],
      });
    }
    throw new OneKeyInternalError();
  }

  async _buildUnsignedTxFromEncodedTx({
    encodedTx,
    transfersInfo,
  }: {
    encodedTx: IEncodedTxCkb;
    transfersInfo: ITransferInfo[];
  }) {
    const client = await this.getClient();
    const txs = await convertTxToTxSkeleton({
      client,
      transaction: encodedTx.tx,
    });

    // check fee is too high
    const allInputAmount = txs
      .get('inputs')
      .toArray()
      .reduce(
        (acc, cur) => acc.plus(new BigNumber(cur.cellOutput.capacity, 16)),
        new BigNumber(0),
      );
    const allOutputAmount = txs
      .get('outputs')
      .toArray()
      .reduce(
        (acc, cur) => acc.plus(new BigNumber(cur.cellOutput.capacity, 16)),
        new BigNumber(0),
      );

    if (
      allInputAmount
        .minus(allOutputAmount)
        .isGreaterThan(new BigNumber(1.5 * 100_000_000))
    ) {
      console.log('Fee is too high, transaction: ', txs);

      throw new OneKeyInternalError('Fee is too high');
    }

    return {
      encodedTx,
      txSize: encodedTx.txSize,
      transfersInfo,
    };
  }

  override async updateUnsignedTx(options: {
    unsignedTx: IUnsignedTxPro;
    feeInfo?: IFeeInfoUnit | undefined;
  }): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo } = options;
    let encodedTxNew = unsignedTx.encodedTx as IEncodedTxCkb;
    if (feeInfo) {
      if (!unsignedTx.transfersInfo || isEmpty(unsignedTx.transfersInfo)) {
        throw new OneKeyInternalError('transfersInfo is required');
      }
      encodedTxNew = await this._attachFeeInfoToEncodedTx({
        encodedTx: unsignedTx.encodedTx as IEncodedTxCkb,
        transfersInfo: unsignedTx.transfersInfo,
        feeInfo,
      });
    }

    unsignedTx.encodedTx = encodedTxNew;

    return Promise.resolve(unsignedTx);
  }

  async _attachFeeInfoToEncodedTx({
    encodedTx,
    feeInfo,
    transfersInfo,
  }: {
    encodedTx: IEncodedTxCkb;
    feeInfo: IFeeInfoUnit;
    transfersInfo: ITransferInfo[];
  }) {
    if (feeInfo.feeCkb?.feeRate) {
      const feeRate = feeInfo.feeCkb.feeRate;

      if (typeof feeRate === 'string') {
        return this._buildEncodedTxFromTransfer({
          transferInfo: transfersInfo[0],
          specifiedFeeRate: feeRate,
        });
      }
    }

    return Promise.resolve(encodedTx);
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const config = await this._getCurrentConfig();
    if (isValidateAddress(address, { config })) {
      return {
        isValid: true,
        normalizedAddress: address,
        displayAddress: address,
      };
    }
    return {
      isValid: false,
      normalizedAddress: '',
      displayAddress: '',
    };
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return this.baseGetPrivateKeyFromImported(params);
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return this.baseValidatePrivateKey(privateKey);
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const client = new RPC(params.rpcUrl);
    const start = performance.now();
    const bestBlockNumber = await client.getTipBlockNumber();
    return {
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber: parseInt(bestBlockNumber, 10),
    };
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo, signedTx } = params;
    const rpcUrl = customRpcInfo.rpc;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
    }
    const client = new RPC(rpcUrl);
    const transaction = convertRawTxToApiTransaction(signedTx.rawTx);
    const txId = await client.sendTransaction(transaction, 'passthrough');
    console.log('broadcastTransaction END:', {
      txid: txId,
      rawTx: signedTx.rawTx,
    });
    return {
      ...params.signedTx,
      txid: txId,
    };
  }
}
