/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { BI } from '@ckb-lumos/bi';
import { Indexer, TransactionCollector } from '@ckb-lumos/ckb-indexer';
import { common, secp256k1Blake160 } from '@ckb-lumos/common-scripts';
import {
  TransactionSkeleton,
  minimalCellCapacityCompatible,
  parseAddress,
} from '@ckb-lumos/helpers';
import { RPC } from '@ckb-lumos/rpc';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import {
  ChangeLessThanMinInputCapacityError,
  InvalidAddress,
  MinimumTransferAmountError,
  OneKeyInternalError,
} from '@onekeyhq/engine/src/errors';
import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import type { PartialTokenInfo } from '@onekeyhq/engine/src/types/provider';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import {
  type IDecodedTx,
  type IDecodedTxActionNativeTransfer,
  IDecodedTxActionType,
  IDecodedTxDirection,
  type IDecodedTxLegacy,
  IDecodedTxStatus,
  type ITransferInfo,
  type IUnsignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import type {
  IDecodedTxAction,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import type {
  TxInput,
  TxOutput,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import { convertFeeValueToGwei } from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';
import type { IVaultInitConfig } from '@onekeyhq/engine/src/vaults/VaultBase';
import { VaultBase } from '@onekeyhq/engine/src/vaults/VaultBase';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { groupBy } from '@onekeyhq/shared/src/utils/arrayUtils';

import { isHexString } from '../../utils/hexUtils';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { isValidateAddress, scriptToAddress } from './utils/address';
import {
  DEFAULT_CONFIRM_BLOCK,
  decodeBalanceWithCell,
  decodeNaiveBalance,
  getBalancesByAddress,
} from './utils/balance';
import { getConfig, initCustomConfig } from './utils/config';
import {
  convertHistoryUtxos,
  convertTokenHistoryUtxos,
  fetchTransactionHistory,
  fullTransactionHistory,
} from './utils/history';
import { createScript } from './utils/script';
import {
  DEFAULT_MIN_INPUT_CAPACITY,
  convertRawTxToApiTransaction,
  convertTxSkeletonToTransaction,
  convertTxToTxSkeleton,
  getTransactionSizeByTxSkeleton,
} from './utils/transaction';
import { getTokenInfo, transfer as xUDTTransafer } from './utils/xudt';

import type { IEncodedTxNervos } from './types/IEncodedTx';
import type { NervosImplOptions } from './types/NervosImplOptions';
import type { Cell } from '@ckb-lumos/base';
import type { Config } from '@ckb-lumos/config-manager';
import type { TransactionSkeletonType } from '@ckb-lumos/helpers';

// @ts-ignore
export default class Vault extends VaultBase {
  override async init(config: IVaultInitConfig): Promise<void> {
    await super.init(config);
    initCustomConfig(await this.getNetworkChainId());
  }

  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  getClientCache = memoizee(async (rpcUrl) => this.getNervosClient(rpcUrl), {
    promise: true,
    max: 1,
    maxAge: getTimeDurationMs({ minute: 5 }),
  });

  async getClient() {
    const rpcURL = await this.getRpcUrl();
    return this.getClientCache(rpcURL);
  }

  async getCurrentConfig() {
    return getConfig(await this.getNetworkChainId());
  }

  getNervosClient(url: string) {
    // client: axios
    return new RPC(url, {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, init),
    });
  }

  getIndexer = memoizee(
    async () => {
      const rpcUrl = await this.getRpcUrl();

      const chainImplInfo = await this.getChainImplInfo();
      const indexerInfo = chainImplInfo.indexer.find(
        (i) => i.rpcUrl === rpcUrl,
      );

      const indexerUrl =
        indexerInfo?.indexerUrl ||
        chainImplInfo.indexer[0]?.indexerUrl ||
        rpcUrl;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return new Indexer(indexerUrl, rpcUrl);
    },
    {
      promise: true,
      max: 1,
      maxAge: getTimeDurationMs({ minute: 5 }),
    },
  );

  getTransactionCollector = memoizee(
    async (address) => {
      const rpcUrl = await this.getRpcUrl();
      const indexer = await this.getIndexer();
      const lock = parseAddress(address);
      return new TransactionCollector(
        indexer,
        {
          lock,
          withData: true,
          order: 'desc',
        },
        rpcUrl,
      );
    },
    {
      promise: true,
      max: 3,
      maxAge: getTimeDurationMs({ minute: 5 }),
    },
  );

  private async getChainImplInfo() {
    const chainInfo = await this.engine.providerManager.getChainInfoByNetworkId(
      this.networkId,
    );
    return chainInfo.implOptions as NervosImplOptions;
  }

  // Chain only methods

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = await this.getClientCache(url);

    const start = performance.now();
    const blockNumber = await client.getTipBlockNumber();
    const latestBlock = parseInt(blockNumber);
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  generateTokenKey(address: string, tokenAddress?: string): string {
    return `${address}-${tokenAddress ?? 'NATIVE'}`;
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const indexer = await this.getIndexer();

    const requestAddress = groupBy(requests, (request) => request.address);
    const config = await this.getCurrentConfig();

    const balances = new Map<string, BigNumber>();

    await Promise.all(
      Object.entries(requestAddress).map(async ([address, tokens]) => {
        await Promise.all(
          tokens.map(async (req) => {
            try {
              const { tokenAddress } = req;
              const xudt = tokenAddress
                ? createScript(config.SCRIPTS.XUDT, tokenAddress)
                : undefined;

              if (tokenAddress && !config.SCRIPTS.XUDT) {
                throw new Error('XUDT not supported');
              }

              balances.set(
                this.generateTokenKey(address, tokenAddress),
                await getBalancesByAddress({
                  indexer,
                  address,
                  config,
                  type: xudt,
                }),
              );
            } catch (e) {
              // ignore
            }
          }),
        );
      }),
    );

    return requests.map((req) => {
      const { address, tokenAddress } = req;
      const key = this.generateTokenKey(address, tokenAddress);
      return balances.get(key) ?? new BigNumber(0);
    });
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxNervos> {
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const { token: tokenAddress, to, amount } = transferInfo;

    const indexer = await this.getIndexer();
    const client = await this.getClient();
    const config = await this.getCurrentConfig();
    const { address: from } = await this.getDbAccount();

    const network = await this.getNetwork();

    let txSkeleton: TransactionSkeletonType = TransactionSkeleton({
      cellProvider: {
        collector: (query) =>
          indexer.collector({ type: 'empty', data: '0x', ...query }),
      },
    });

    const { median } = await client.getFeeRateStatistics();

    let amountValue;
    if (tokenAddress) {
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        tokenAddress,
      );
      if (!token) {
        throw new OneKeyInternalError('Invalid token address');
      }
      amountValue = new BigNumber(amount).shiftedBy(token.decimals).toFixed();
      // token transfer
      // support XUDT
      txSkeleton = await xUDTTransafer(
        txSkeleton,
        from,
        token,
        tokenAddress,
        to,
        BI.from(amountValue),
      );
    } else {
      amountValue = new BigNumber(amount).shiftedBy(network.decimals).toFixed();

      if (BI.from(amountValue).lt(DEFAULT_MIN_INPUT_CAPACITY)) {
        throw new MinimumTransferAmountError('61');
      }

      // native transfer
      txSkeleton = await secp256k1Blake160.transferCompatible(
        txSkeleton,
        from,
        to,
        BI.from(amountValue),
      );
    }

    try {
      txSkeleton = await common.payFeeByFeeRate(
        txSkeleton,
        [from],
        median,
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
          .shiftedBy(network.decimals)
          .toFixed();
        throw new ChangeLessThanMinInputCapacityError(miniAmount);
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
    if (allInputAmount.isLessThanOrEqualTo(allOutputAmount)) {
      // fix max send fee
      const size = getTransactionSizeByTxSkeleton(txSkeleton);
      limit = new BigNumber(median, 16).multipliedBy(size).div(1024).toFixed(0);

      debugLogger.common.info('fix max send fee,', {
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
      transferInfo,
      tx,
      feeInfo: {
        price: '1',
        limit,
      },
    };
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxNervos,
  ): Promise<IUnsignedTxPro> {
    const config = await this.getCurrentConfig();

    const client = await this.getClient();
    const txs = await convertTxToTxSkeleton({
      client,
      transaction: encodedTx.tx,
    });

    const inputsInUnsignedTx: TxInput[] = [];
    for (const input of txs.get('inputs').toArray()) {
      const value = decodeBalanceWithCell(input, config);
      inputsInUnsignedTx.push({
        address: scriptToAddress(input.cellOutput.lock, { config }),
        value,
        // publicKey,
        utxo: {
          txid: input.outPoint?.txHash ?? '',
          vout: new BigNumber(input.outPoint?.index ?? '0x00', 16).toNumber(),
          value,
        },
        tokenAddress: input.cellOutput.type?.args,
      });
    }

    const outputsInUnsignedTx: TxOutput[] = [];
    for (const output of txs.get('outputs').toArray()) {
      const value = decodeBalanceWithCell(output, config);
      outputsInUnsignedTx.push({
        address: scriptToAddress(output.cellOutput.lock, { config }),
        value,
        tokenAddress: output.cellOutput.type?.args,
        payload: { data: output.data },
      });
    }

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
        .isGreaterThan(new BigNumber(1.5 * 100000000))
    ) {
      debugLogger.common.error('Fee is too high, transaction: ', txs);

      throw new OneKeyInternalError('Fee is too high');
    }

    const ret = {
      inputs: inputsInUnsignedTx,
      outputs: outputsInUnsignedTx,
      payload: {
        txSkeleton: txs,
      },
      encodedTx,
    };

    return Promise.resolve(ret);
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  async decodeTx(
    encodedTx: IEncodedTxNervos,
    payload?: any,
  ): Promise<IDecodedTx> {
    const client = await this.getClient();
    const txs = await convertTxToTxSkeleton({
      client,
      transaction: encodedTx.tx,
    });

    const inputs = txs.get('inputs').toArray();
    const outputs = txs.get('outputs').toArray();

    const config = await this.getCurrentConfig();
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);

    const toAddressOutput =
      outputs.find(
        (output) =>
          scriptToAddress(output.cellOutput.lock, { config }) !==
          dbAccount.address,
      ) ?? outputs[0];

    if (!toAddressOutput) {
      throw new OneKeyInternalError('No to address output found');
    }

    const toAddress = scriptToAddress(toAddressOutput.cellOutput.lock, {
      config,
    });

    let actions: IDecodedTxAction[] = [];

    const nativeTransfer: IDecodedTxActionNativeTransfer = {
      tokenInfo: nativeToken,
      utxoFrom: inputs.map((input) => ({
        address: scriptToAddress(input.cellOutput.lock, { config }),
        balance: decodeNaiveBalance(input)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: decodeNaiveBalance(input)?.toString() ?? '0',
        symbol: network.symbol,
        isMine: true,
      })),
      utxoTo: outputs.map((output) => ({
        address: scriptToAddress(output.cellOutput.lock, { config }),
        balance: decodeNaiveBalance(output)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: decodeNaiveBalance(output).toString(),
        symbol: network.symbol,
        isMine: false, // output.address === dbAccount.address,
      })),
      from: dbAccount.address,
      to: toAddress,
      amount: decodeNaiveBalance(toAddressOutput)
        .shiftedBy(-network.decimals)
        .toFixed(),
      amountValue: decodeNaiveBalance(toAddressOutput).toString(),
      extraInfo: null,
    };

    actions.push({
      type: IDecodedTxActionType.NATIVE_TRANSFER,
      direction:
        toAddress === dbAccount.address
          ? IDecodedTxDirection.OUT
          : IDecodedTxDirection.SELF,
      nativeTransfer,
    });

    const tokens = inputs.reduce((acc, cur) => {
      const tokenAddress = cur.cellOutput.type?.args;
      if (tokenAddress) {
        return acc.add(tokenAddress);
      }
      return acc;
    }, new Set<string>());

    let existsToken = false;
    for (const tokenAddress of tokens) {
      const tokenActions = await this.decodeTokenHistory({
        txSkeleton: txs,
        config,
        tokenAddress,
      });
      actions = [...actions, ...tokenActions];
      if (tokenActions.length > 0) {
        existsToken = true;
      }
    }

    if (existsToken && actions.length > 1) {
      const action = actions[0];
      const isNativeToken =
        action.type === IDecodedTxActionType.NATIVE_TRANSFER;

      const isZero = new BigNumber(
        action.nativeTransfer?.amount ?? '0',
      ).isLessThanOrEqualTo('0');

      if (isNativeToken && isZero) {
        actions = actions.slice(1);
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

    return {
      txid: '',
      owner: dbAccount.address,
      signer: dbAccount.address,
      nonce: 0,
      actions,
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      totalFeeInNative: fee,
    };
  }

  async fetchFeeInfo(encodedTx: IEncodedTxNervos): Promise<IFeeInfo> {
    const network = await this.engine.getNetwork(this.networkId);
    const { feeInfo } = encodedTx;

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit: feeInfo?.limit ?? '1',
      prices: [
        convertFeeValueToGwei({
          value: '1',
          network,
        }),
      ],
      defaultPresetIndex: '0',
    };
  }

  async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxNervos;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxNervos> {
    const { price, limit } = params.feeInfoValue;

    return Promise.resolve({
      ...params.encodedTx,
      feeInfo: {
        price,
        limit,
      },
    });
  }

  // Max send
  async updateEncodedTx(
    encodedTx: IEncodedTxNervos,
    payload: IEncodedTxUpdatePayloadTransfer,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxNervos> {
    return Promise.resolve(encodedTx);
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    const client = await this.getClient();

    debugLogger.engine.info('nervos broadcastTransaction start:', {
      rawTx: signedTx.rawTx,
    });
    try {
      const { rawTx } = signedTx;
      const transaction = convertRawTxToApiTransaction(rawTx);
      const txid = await client.sendTransaction(transaction, 'passthrough');

      return {
        ...signedTx,
        txid,
      };
    } catch (error: any) {
      const { errorCode, message }: { errorCode: any; message: string } =
        error || {};
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const errorMessage = `${errorCode ?? ''} ${message}`;
      throw new OneKeyInternalError(errorMessage);
    }
  }

  // ====== token ======
  async getTokenInfo(tokenAddress: string) {
    const config = await this.getCurrentConfig();
    return getTokenInfo(tokenAddress, config);
  }

  override async validateTokenAddress(address: string): Promise<string> {
    if (!isHexString(address)) {
      throw new InvalidAddress('Invalid address');
    }
    return address;
  }

  async fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    return Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        try {
          return await this.getTokenInfo(tokenAddress);
        } catch (e) {
          // pass
        }
      }),
    );
  }

  // ====== transfer status ======
  override async getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    const client = await this.getClient();
    const chainBlockNumber = new BigNumber(
      await client.getTipBlockNumber(),
      16,
    );

    const txStatuses = new Map<string, TransactionStatus>();
    for (const txid of txids) {
      const tx = await client.getTransaction(txid);

      let status = TransactionStatus.PENDING;
      if (tx.txStatus.blockHash) {
        const blockHeader = await client.getHeader(
          tx.txStatus.blockHash,
          '0x1',
        );
        const isConfirmed = chainBlockNumber
          .minus(new BigNumber(blockHeader.number, 16))
          .isGreaterThanOrEqualTo(DEFAULT_CONFIRM_BLOCK);

        if (tx.txStatus.status === 'committed' && isConfirmed) {
          status = TransactionStatus.CONFIRM_AND_SUCCESS;
        }
      }
      txStatuses.set(txid, status);
    }

    return txids.map((txid) => txStatuses.get(txid));
  }

  async decodeTokenHistory({
    txSkeleton,
    config,
    tokenAddress,
  }: {
    txSkeleton: TransactionSkeletonType;
    config: Config;
    tokenAddress: string;
  }) {
    const tokenDb = await this.engine.ensureTokenInDB(
      this.networkId,
      tokenAddress,
    );

    let token: PartialTokenInfo | undefined;
    if (tokenDb) {
      token = {
        symbol: tokenDb.symbol,
        name: tokenDb.name,
        decimals: tokenDb.decimals,
      };
    }

    if (!token) {
      token = await getTokenInfo(tokenAddress, config);
    }

    if (!token) {
      return [];
    }

    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;

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
      dbAccount.address,
      token,
      config,
    );
    const utxoTo = convertTokenHistoryUtxos(
      Array.from(outputs),
      dbAccount.address,
      token,
      config,
    );

    const inputWithMine = utxoFrom.find((input) => input.isMine);

    const utxoToWithoutMine = utxoTo.filter((output) => !output.isMine);
    const utxoToWithMine = utxoTo.filter((output) => output.isMine);

    let direction: IDecodedTxDirection;
    let from = dbAccount.address;
    let to = dbAccount.address;
    let amount = '0';
    let amountValue = '0';

    if (inputWithMine) {
      direction = IDecodedTxDirection.OUT;
      const res = utxoTo.find((output) => !output.isMine);
      to = res ? res.address : dbAccount.address;
      amount = utxoToWithoutMine
        .filter((utxo) => utxo.address === to)
        .reduce((acc, cur) => acc.plus(cur.balance), new BigNumber(0))
        .toFixed();
      amountValue = new BigNumber(amount).shiftedBy(-token.decimals).toFixed();
    } else {
      direction = IDecodedTxDirection.IN;
      const res = utxoFrom.find((output) => !output.isMine);
      from = res ? res.address : dbAccount.address;
      amount = utxoToWithMine
        .reduce((acc, cur) => acc.plus(cur.balance), new BigNumber(0))
        .toFixed();
      amountValue = new BigNumber(amount).shiftedBy(-token.decimals).toFixed();
    }

    let actions: IDecodedTxAction[];
    if (utxoToWithoutMine && utxoToWithoutMine.length) {
      const outputTo =
        direction === IDecodedTxDirection.OUT
          ? utxoToWithoutMine
          : utxoToWithMine;

      actions = outputTo.map((utxo) => ({
        type: IDecodedTxActionType.TOKEN_TRANSFER,
        direction,
        tokenTransfer: {
          tokenInfo: {
            id: '',
            networkId: this.networkId,
            symbol: token?.symbol ?? '',
            name: token?.name ?? '',
            decimals: token?.decimals ?? 0,
            tokenIdOnNetwork: tokenAddress,
            logoURI: '',
          },
          from,
          to: utxo.address,
          amount,
          amountValue,
          extraInfo: null,
        },
      }));
    } else {
      actions = [
        {
          type: IDecodedTxActionType.TOKEN_TRANSFER,
          direction,
          tokenTransfer: {
            tokenInfo: {
              id: '',
              networkId: this.networkId,
              symbol: token?.symbol ?? '',
              name: token?.name ?? '',
              decimals: token?.decimals ?? 0,
              tokenIdOnNetwork: tokenAddress,
              logoURI: '',
            },
            from,
            // For out transaction, use first address as to.
            // For in or self transaction, use first owned address as to.
            to,
            amount,
            amountValue,
            extraInfo: null,
          },
        },
      ];
    }

    return actions;
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [] } = options;
    const network = await this.getNetwork();
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;

    const client = await this.getClient();
    const { address } = dbAccount;

    const transactionCollector = await this.getTransactionCollector(address);

    const transferHistoryArray = await fetchTransactionHistory({
      limit: 20,
      transactionCollector,
    });

    const history = await fullTransactionHistory({
      client,
      transferHistoryArray,
    });

    const config = await this.getCurrentConfig();
    const chainBlockNumber = new BigNumber(
      await client.getTipBlockNumber(),
      16,
    );

    const txs = history.map(async (tx) => {
      try {
        const historyTxToMerge = localHistory.find(
          (item) => item.decodedTx.txid === tx.txWithStatus.transaction.hash,
        );
        if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
          // No need to update.
          return null;
        }

        const {
          txStatus: { status },
          transaction: { hash: txHash },
        } = tx.txWithStatus;
        const { timestamp, number: txBlockNumber } = tx.txBlockHeader;
        const { inputs, outputs } = tx.txSkeleton;

        const txid = txHash;
        const time = new BigNumber(timestamp, 16).toString();

        const token = await this.engine.getNativeTokenInfo(this.networkId);
        const utxoFrom = convertHistoryUtxos(
          Array.from(inputs.filter((input) => input.cellOutput.type === null)),
          dbAccount.address,
          token,
          config,
        );
        const utxoTo = convertHistoryUtxos(
          Array.from(outputs.filter((input) => input.cellOutput.type === null)),
          dbAccount.address,
          token,
          config,
        );

        const inputIncludeMine = utxoFrom.find((input) => input.isMine);

        const outputWithoutMine = utxoTo.filter((output) => !output.isMine);
        const outputWithMine = utxoTo.filter((output) => output.isMine);

        let direction: IDecodedTxDirection;
        let from = dbAccount.address;
        let to = dbAccount.address;
        let amount = '0';
        let amountValue = '0';

        if (inputIncludeMine) {
          direction = IDecodedTxDirection.OUT;
          const res = utxoTo.find((output) => !output.isMine);
          to = res ? res.address : dbAccount.address;
          amount = outputWithoutMine
            .filter((utxo) => utxo.address === to)
            .reduce((acc, cur) => acc.plus(cur.balance), new BigNumber(0))
            .toFixed();
          amountValue = new BigNumber(amount)
            .shiftedBy(-network.decimals)
            .toFixed();
        } else {
          direction = IDecodedTxDirection.IN;
          const res = utxoFrom.find((output) => !output.isMine);
          from = res ? res.address : dbAccount.address;
          amount = outputWithMine
            .reduce((acc, cur) => acc.plus(cur.balance), new BigNumber(0))
            .toFixed();
          amountValue = new BigNumber(amount)
            .shiftedBy(-network.decimals)
            .toFixed();
        }

        let actions: IDecodedTxAction[];
        if (outputWithoutMine && outputWithoutMine.length) {
          const outputTo =
            direction === IDecodedTxDirection.OUT
              ? outputWithoutMine
              : outputWithMine;

          actions = outputTo.map((utxo) => ({
            type: IDecodedTxActionType.NATIVE_TRANSFER,
            direction,
            nativeTransfer: {
              tokenInfo: token,
              utxoFrom,
              utxoTo,
              from,
              to: utxo.address,
              amount,
              amountValue,
              extraInfo: null,
            },
          }));
        } else {
          actions = [
            {
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              direction,
              nativeTransfer: {
                tokenInfo: token,
                utxoFrom,
                utxoTo,
                from,
                // For out transaction, use first address as to.
                // For in or self transaction, use first owned address as to.
                to,
                amount,
                amountValue,
                extraInfo: null,
              },
            },
          ];
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
          const tokenActions = await this.decodeTokenHistory({
            txSkeleton: tx.txSkeleton,
            config,
            tokenAddress,
          });

          if (actions.length === 0 && tokenActions.length === 0) {
            return await Promise.resolve(null);
          }

          actions = [...actions, ...tokenActions];

          if (tokenActions.length > 0) {
            existsToken = true;
          }
        }

        if (existsToken && actions.length > 1) {
          const action = actions[0];
          const isNativeToken =
            action.type === IDecodedTxActionType.NATIVE_TRANSFER;

          const isZero = new BigNumber(
            action.nativeTransfer?.amount ?? '0',
          ).isLessThanOrEqualTo('0');

          if (isNativeToken && isZero) {
            actions = actions.slice(1);
          }
        }

        const allInputAmount = inputs.reduce(
          (acc, cur) => acc.plus(new BigNumber(cur.cellOutput.capacity, 16)),
          new BigNumber(0),
        );
        const allOutputAmount = outputs.reduce(
          (acc, cur) => acc.plus(new BigNumber(cur.cellOutput.capacity, 16)),
          new BigNumber(0),
        );
        const fee = allInputAmount
          .minus(allOutputAmount)
          .shiftedBy(-network.decimals)
          .toFixed();

        const isConfirmed = chainBlockNumber
          .minus(new BigNumber(txBlockNumber, 16))
          .isGreaterThanOrEqualTo(DEFAULT_CONFIRM_BLOCK);

        const decodedTx: IDecodedTx = {
          txid: txid ?? '',
          owner: dbAccount.address,
          signer: dbAccount.address,
          nonce: 0,
          actions,
          status:
            status === 'committed' && isConfirmed
              ? IDecodedTxStatus.Confirmed
              : IDecodedTxStatus.Pending,
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: null,
          totalFeeInNative: fee,
        };
        decodedTx.updatedAt =
          typeof time !== 'undefined' ? parseInt(time) : Date.now();
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
        decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;

        return await this.buildHistoryTx({
          decodedTx,
          historyTxToMerge,
        });
      } catch (error) {
        console.error(error);
        return Promise.resolve(null);
      }
    });

    return (await Promise.all(txs)).filter(Boolean);
  }

  // ===== validate util =====
  override async validateAddress(address: string) {
    const config = await this.getCurrentConfig();
    if (isValidateAddress(address, { config })) return Promise.resolve(address);
    return Promise.reject(new InvalidAddress());
  }

  override async validateWatchingCredential(input: string) {
    return this.validateAddress(input)
      .then((address) => this.settings.watchingAccountEnabled && !!address)
      .catch(() => false);
  }

  isHexPrivateKey(input: string) {
    return /^(0x)?[0-9a-zA-Z]{64}$/.test(input);
  }

  override async validateImportedCredential(input: string): Promise<boolean> {
    // Generic private key test, override if needed.
    return Promise.resolve(
      this.settings.importedAccountEnabled && this.isHexPrivateKey(input),
    );
  }
}
