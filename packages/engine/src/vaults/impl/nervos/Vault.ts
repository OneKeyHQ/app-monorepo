/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { Indexer, TransactionCollector } from '@ckb-lumos/ckb-indexer';
import { parseAddress } from '@ckb-lumos/helpers';
import { RPC } from '@ckb-lumos/rpc';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import {
  InvalidAddress,
  OneKeyInternalError,
} from '@onekeyhq/engine/src/errors';
import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import {
  type IDecodedTx,
  type IDecodedTxActionNativeTransfer,
  IDecodedTxActionType,
  IDecodedTxDirection,
  type IDecodedTxLegacy,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
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
import type { TxInput } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import { convertFeeValueToGwei } from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';
import { VaultBase } from '@onekeyhq/engine/src/vaults/VaultBase';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { groupBy } from '@onekeyhq/shared/src/utils/arrayUtils';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { isValidateAddress, scriptToAddress } from './utils/address';
import {
  DEFAULT_CONFIRM_BLOCK,
  fetchConfirmCellsByAddress,
  getBalancesByAddress,
  getConfirmBalancesByAddress,
  getFrozenBalancesByAddress,
} from './utils/balance';
import { getConfig } from './utils/config';
import {
  convertHistoryUtxos,
  fetchTransactionHistory,
  fullTransactionHistory,
} from './utils/history';
import {
  convertEncodeTxNervosToSkeleton,
  convertRawTxToApiTransaction,
  fillSkeletonWitnessesWithAccount,
  getTransactionSizeByTxSkeleton,
  prepareAndBuildTx,
} from './utils/transaction';

import type { IEncodedTxNervos } from './types/IEncodedTx';
import type { NervosImplOptions } from './types/NervosImplOptions';

// @ts-ignore
export default class Vault extends VaultBase {
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

  override async getFrozenBalance({
    password,
  }: {
    password?: string;
    useRecycleBalance?: boolean;
    ignoreInscriptions?: boolean;
    useCustomAddressesBalance?: boolean;
  } = {}): Promise<number | Record<string, number>> {
    const indexer = await this.getIndexer();
    const client = await this.getClient();
    const dbAccount = await this.getDbAccount();
    const balance = await getFrozenBalancesByAddress({
      indexer,
      address: dbAccount.address,
      client,
    });

    const network = await this.engine.getNetwork(this.networkId);
    return balance.shiftedBy(-network.decimals).toNumber();
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const indexer = await this.getIndexer();

    const requestAddress = groupBy(requests, (request) => request.address);

    const balances = new Map<string, BigNumber>();
    await Promise.all(
      Object.entries(requestAddress).map(async ([address, tokens]) => {
        try {
          try {
            balances.set(
              address,
              await getBalancesByAddress({ indexer, address }),
            );
          } catch (e) {
            // ignore
          }
        } catch (error) {
          // ignore account error
        }
      }),
    );

    return requests.map((req) => {
      const { address } = req;
      return balances.get(address) ?? new BigNumber(0);
    });
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
    specifiedFeeRate?: IFeeInfoUnit,
  ): Promise<IEncodedTxNervos> {
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const { token: tokenAddress } = transferInfo;
    if (tokenAddress)
      throw new OneKeyInternalError('Nervos does not support token transfer');

    const indexer = await this.getIndexer();
    const client = await this.getClient();
    const config = getConfig(await this.getNetworkChainId());
    const { address: from } = await this.getDbAccount();

    const network = await this.getNetwork();
    const confirmCellsByAddress = await fetchConfirmCellsByAddress({
      indexer,
      address: from,
      client,
    });
    const transaction = prepareAndBuildTx({
      confirmCells: confirmCellsByAddress,
      from,
      network,
      transferInfo,
      config,
      specifiedFeeRate,
    });

    return transaction;
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxNervos,
  ): Promise<IUnsignedTxPro> {
    const { inputs, outputs, change } = encodedTx;

    const config = getConfig(await this.getNetworkChainId());

    const inputsInUnsignedTx: TxInput[] = [];
    for (const input of inputs) {
      const value = new BigNumber(input.cellOutput.capacity, 16);
      inputsInUnsignedTx.push({
        address: scriptToAddress(input.cellOutput.lock, { config }),
        value,
        // publicKey,
        utxo: {
          txid: input.outPoint?.txHash ?? '',
          vout: new BigNumber(input.outPoint?.index ?? '0x00', 16).toNumber(),
          value,
        },
      });
    }

    const outputsInUnsignedTx = outputs.map(({ address, value, data }) => ({
      address,
      value: new BigNumber(value),
      payload: { data },
    }));

    if (change) {
      outputsInUnsignedTx.push({
        address: change.address,
        value: new BigNumber(change.value),
        payload: { data: change.data },
      });
    }

    const ret = {
      inputs: inputsInUnsignedTx,
      outputs: outputsInUnsignedTx,
      payload: {},
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
    const { inputs, outputs, feeInfo } = encodedTx;

    const config = getConfig(await this.getNetworkChainId());
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const token = await this.engine.getNativeTokenInfo(this.networkId);

    const nativeTransfer: IDecodedTxActionNativeTransfer = {
      tokenInfo: token,
      utxoFrom: inputs.map((input) => ({
        address: scriptToAddress(input.cellOutput.lock, { config }),
        balance: new BigNumber(input.cellOutput.capacity, 16)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue:
          new BigNumber(input.cellOutput.capacity, 16)?.toString() ?? '0',
        symbol: network.symbol,
        isMine: true,
      })),
      utxoTo: outputs.map((output) => ({
        address: output.address,
        balance: new BigNumber(output.value)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: output.value.toString(),
        symbol: network.symbol,
        isMine: false, // output.address === dbAccount.address,
      })),
      from: dbAccount.address,
      to: outputs[0].address,
      amount: new BigNumber(outputs[0].value)
        .shiftedBy(-network.decimals)
        .toFixed(),
      amountValue: outputs[0].value,
      extraInfo: null,
    };

    return {
      txid: '',
      owner: dbAccount.address,
      signer: dbAccount.address,
      nonce: 0,
      actions: [
        {
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          direction:
            outputs[0].address === dbAccount.address
              ? IDecodedTxDirection.OUT
              : IDecodedTxDirection.SELF,
          nativeTransfer,
        },
      ],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      totalFeeInNative: new BigNumber(feeInfo?.limit ?? '0')
        .multipliedBy(feeInfo?.price ?? '0.00000001')
        .toFixed(),
    };
  }

  async fetchFeeInfo(encodedTx: IEncodedTxNervos): Promise<IFeeInfo> {
    const network = await this.engine.getNetwork(this.networkId);
    const config = getConfig(await this.getNetworkChainId());
    const client = await this.getClient();

    let skeleton = convertEncodeTxNervosToSkeleton({
      encodedTxNervos: encodedTx,
      config,
    });
    skeleton = fillSkeletonWitnessesWithAccount({
      sendAccount: (await this.getDbAccount()).address,
      txSkeleton: skeleton,
      config,
    });

    const limit = getTransactionSizeByTxSkeleton(skeleton);

    const { median } = await client.getFeeRateStatistics();
    const price = convertFeeValueToGwei({
      value: new BigNumber(median, 16).dividedBy(1024).toFixed(0),
      network,
    });

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit: new BigNumber(limit).multipliedBy(1.1).toFixed(0),
      prices: [price],
      defaultPresetIndex: '0',
    };
  }

  async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxNervos;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxNervos> {
    const { price, limit } = params.feeInfoValue;

    if (typeof price === 'undefined' || typeof price !== 'string') {
      throw new OneKeyInternalError('Invalid gas price.');
    }
    if (typeof limit !== 'string') {
      throw new OneKeyInternalError('Invalid fee limit');
    }

    if (typeof price === 'string' && typeof limit === 'string') {
      return this.buildEncodedTxFromTransfer(params.encodedTx.transferInfo, {
        price,
        limit,
      });
    }

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
    const { outputs } = encodedTx;
    if (options.type === IEncodedTxUpdateType.transfer && outputs.length > 0) {
      const network = await this.getNetwork();

      const fee = new BigNumber(payload.feeInfo?.limit ?? '512').multipliedBy(
        '1.1',
      );

      const sendAmount = new BigNumber(payload.totalBalance ?? payload.amount)
        .shiftedBy(network.decimals)
        .toFixed(0);

      return Promise.resolve({
        ...encodedTx,
        hasMaxSend: true,
        outputs: [
          {
            address: outputs[0].address,
            value: sendAmount,
          },
        ],
        mass: parseInt(fee.toFixed(0)),
      });
    }
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
      limit: 10,
      transactionCollector,
    });

    const history = await fullTransactionHistory({
      client,
      transferHistoryArray,
    });

    const config = getConfig(await this.getNetworkChainId());
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
          Array.from(inputs),
          dbAccount.address,
          token,
          config,
        );
        const utxoTo = convertHistoryUtxos(
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
          amountValue = new BigNumber(amount)
            .shiftedBy(-network.decimals)
            .toFixed();
        } else {
          direction = IDecodedTxDirection.IN;
          const res = utxoFrom.find((output) => !output.isMine);
          from = res ? res.address : dbAccount.address;
          amount = utxoToWithMine
            .reduce((acc, cur) => acc.plus(cur.balance), new BigNumber(0))
            .toFixed();
          amountValue = new BigNumber(amount)
            .shiftedBy(-network.decimals)
            .toFixed();
        }

        let actions: IDecodedTxAction[];
        if (utxoToWithoutMine && utxoToWithoutMine.length) {
          const outputTo =
            direction === IDecodedTxDirection.OUT
              ? utxoToWithoutMine
              : utxoToWithMine;

          actions = outputTo.map((utxo) => ({
            type: IDecodedTxActionType.NATIVE_TRANSFER,
            direction,
            nativeTransfer: {
              tokenInfo: token,
              utxoFrom,
              utxoTo,
              from,
              to: utxo.address,
              amount: utxo.balance,
              amountValue: utxo.balanceValue,
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
    const config = getConfig(await this.getNetworkChainId());
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
