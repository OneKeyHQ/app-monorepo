/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import {
  Connection,
  JsonRpcProvider,
  TransactionBlock,
  builder,
  getExecutionStatus,
  getTimestampFromTransactionResponse,
  getTotalGasUsed,
  getTransaction,
  getTransactionDigest,
  getTransactionSender,
  isValidSuiAddress,
} from '@mysten/sui.js';
import BigNumber from 'bignumber.js';
import { get, groupBy, isArray, isEmpty } from 'lodash';

import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type { PartialTokenInfo } from '@onekeyhq/engine/src/types/provider';
import type { Token } from '@onekeyhq/kit/src/store/typings';
import {
  getTimeDurationMs,
  getTimeStamp,
} from '@onekeyhq/kit/src/utils/helper';
import { log } from '@onekeyhq/shared/src/crashlytics/index.web';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import {
  InsufficientBalance,
  InvalidAddress,
  InvalidTokenAddress,
  NotImplemented,
  OneKeyError,
  OneKeyInternalError,
} from '../../../errors';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
} from '../../types';
import { convertFeeValueToGwei } from '../../utils/feeInfoUtils';
import { addHexPrefix, stripHexPrefix } from '../../utils/hexUtils';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { parseTransferObjects } from './parses/Transaction';
import { OneKeyJsonRpcProvider } from './provider/OnekeyJsonRpcProvider';
import settings from './settings';
import {
  GAS_SAFE_OVERHEAD,
  GAS_TYPE_ARG,
  SUI_NATIVE_COIN,
  computeGasBudget,
  deduplicate,
  dryRunTransactionBlock,
  moveCallTxnName,
  normalizeSuiCoinType,
} from './utils';
import { createCoinSendTransaction, getAllCoins } from './utils/Coin';
import {
  decodeActionWithTransferObjects,
  waitPendingTransaction,
} from './utils/Transaction';

import type { DBSimpleAccount } from '../../../types/account';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxSUI } from './types';
import type {
  CoinBalance,
  SignatureScheme,
  SuiTransactionBlockResponse,
  SuiTransactionBlockResponseOptions,
} from '@mysten/sui.js';

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

  getClientCache = memoizee(async (rpcUrl) => this.getSuiClient(rpcUrl), {
    promise: true,
    max: 1,
    maxAge: getTimeDurationMs({ minute: 3 }),
  });

  async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getClientCache(rpcURL);
  }

  getSuiClient(url: string) {
    // client: jayson > cross-fetch
    return new OneKeyJsonRpcProvider(
      new Connection({
        fullnode: url,
        faucet: 'https://faucet.testnet.sui.io/gas',
      }),
    );
  }

  // Chain only methods
  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = await this.getClientCache(url);

    const start = performance.now();

    const latestBlock = await client.getTotalTransactionBlocks();
    return {
      responseTime: Math.floor(performance.now() - start),
      latestBlock: Number(latestBlock),
    };
  }

  async _getPublicKey({
    prefix = true,
  }: {
    prefix?: boolean;
  } = {}): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    let publicKey = dbAccount.pub;
    if (prefix) {
      publicKey = addHexPrefix(publicKey);
    }
    return Promise.resolve(publicKey);
  }

  override async validateAddress(address: string) {
    if (!isValidSuiAddress(address)) {
      return Promise.reject(new InvalidAddress());
    }
    return Promise.resolve(address);
  }

  override validateWatchingCredential(input: string) {
    return this.validateAddress(input)
      .then((address) => this.settings.watchingAccountEnabled && !!address)
      .catch(() => false);
  }

  override async checkAccountExistence(address: string): Promise<boolean> {
    const client = await this.getClient();

    const accountData = await client.getObject({ id: stripHexPrefix(address) });

    return !accountData.error;
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();
    const requestAddress = groupBy(requests, (request) => request.address);

    const balances = new Map<string, BigNumber>();
    await Promise.all(
      Object.entries(requestAddress).map(async ([address, tokens]) => {
        try {
          const resources: CoinBalance[] = await client.getAllBalances({
            owner: address,
          });

          const coinBalances: Record<string, string> = {};
          for (const resource of resources) {
            coinBalances[resource.coinType] = resource.totalBalance.toString();
          }
          tokens.forEach((req) => {
            const { tokenAddress } = req;

            const typeTag =
              tokenAddress != null
                ? normalizeSuiCoinType(tokenAddress)
                : SUI_NATIVE_COIN;

            const apiTypeTag = (tokenAddress ?? SUI_NATIVE_COIN).replace(
              /^0x0*/,
              '0x',
            );
            const balance = coinBalances[apiTypeTag]?.toString() ?? '0';
            const key = `${address}-${typeTag}`;
            try {
              balances.set(key, new BigNumber(balance));
            } catch (e) {
              // ignore
            }
          });
        } catch (error) {
          // ignore account error
        }
      }),
    );

    return requests.map((req) => {
      const { address, tokenAddress } = req;
      const key = `${address}-${tokenAddress ?? SUI_NATIVE_COIN}`;
      return balances.get(key) ?? new BigNumber(0);
    });
  }

  override async activateAccount() {
    const client = await this.getClient();
    await client.requestSuiFromFaucet(await this.getAccountAddress());
  }

  async fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    const client = await this.getClient();

    return Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        try {
          const coinInfo = await client.getCoinMetadata({
            coinType: normalizeSuiCoinType(tokenAddress),
          });

          if (!coinInfo) return undefined;

          return await Promise.resolve({
            name: coinInfo.name,
            symbol: coinInfo.symbol,
            decimals: coinInfo.decimals,
          });
        } catch (e) {
          // pass
        }
      }),
    );
  }

  override async validateTokenAddress(tokenAddress: string): Promise<string> {
    const [address, module, name] = tokenAddress.split('::');
    if (module && name) {
      try {
        return `${(
          await this.validateAddress(address)
        ).toLowerCase()}::${module}::${name}`;
      } catch {
        // pass
      }
    }
    throw new InvalidTokenAddress();
  }

  override async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxSUI;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxSUI> {
    const { price, limit } = params.feeInfoValue;
    if (typeof price !== 'undefined' && typeof price !== 'string') {
      throw new OneKeyInternalError('Invalid gas price.');
    }
    if (typeof limit !== 'string') {
      throw new OneKeyInternalError('Invalid fee limit');
    }

    const newTx = TransactionBlock.from(params.encodedTx.rawTx);
    newTx.blockData.gasConfig.price = price;
    newTx.blockData.gasConfig.budget = limit;

    return Promise.resolve({
      rawTx: newTx.serialize(),
      feeInfo: {
        price,
        limit,
      },
    });
  }

  override decodedTxToLegacy(
    _decodedTx: IDecodedTx,
  ): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async decodeTx(
    encodedTx: IEncodedTxSUI,
    _payload?: any,
  ): Promise<IDecodedTx> {
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    let token: Token | undefined = await this.engine.getNativeTokenInfo(
      this.networkId,
    );

    const client = await this.getClient();
    const sender = await this.getAccountAddress();
    const transactionBlock = TransactionBlock.from(encodedTx.rawTx);

    if (!transactionBlock) throw new OneKeyError('Invalid transaction data.');

    const actions: IDecodedTxAction[] = [];

    const { inputs, transactions, gasConfig } = transactionBlock.blockData;

    let gasLimit = '0';
    if (transactionBlock.blockData.gasConfig.budget) {
      gasLimit = transactionBlock.blockData.gasConfig.budget ?? '0';
    }

    try {
      for (const transaction of transactions) {
        switch (transaction.kind) {
          case 'TransferObjects': {
            const action = await decodeActionWithTransferObjects(
              client,
              transaction,
              transactions,
              inputs,
              gasConfig.payment,
            );
            if (action && typeof action.recipient === 'string') {
              let actionKey = 'nativeTransfer';
              if (!action.isNative) {
                actionKey = 'tokenTransfer';
                if (!action.coinType)
                  throw new OneKeyInternalError('Invalid coin type');
                token = await this.engine.ensureTokenInDB(
                  this.networkId,
                  normalizeSuiCoinType(action.coinType),
                );

                if (!token) throw new OneKeyInternalError('Invalid coin type');
              }
              actions.push({
                type: action.type,
                [actionKey]: {
                  tokenInfo: token,
                  from: sender,
                  to: action.recipient,
                  amount: new BigNumber(action.amount.toString() ?? '0')
                    .shiftedBy(-token.decimals)
                    .toFixed(),
                  amountValue: action.amount?.toString() ?? '0',
                  extraInfo: null,
                },
              });
            }
            break;
          }
          case 'MoveCall': {
            if (transaction.kind !== 'MoveCall') break;
            const args: string[] = [];
            let argInput;
            for (const arg of transaction.arguments ?? []) {
              switch (arg.kind) {
                case 'Input':
                case 'Result':
                case 'NestedResult':
                  argInput = inputs[arg.index];
                  if (argInput.type === 'pure') {
                    const argValue = get(
                      argInput.value,
                      'Pure',
                      argInput.value,
                    );

                    try {
                      args.push(builder.de('vector<u8>', argValue));
                    } catch (e) {
                      try {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                        args.push(argValue.toString());
                      } catch (error) {
                        // ignore
                      }
                    }
                  } else if (argInput.type === 'object') {
                    try {
                      args.push(JSON.stringify(argInput.value));
                    } catch (e) {
                      args.push('unable to parse object');
                    }
                  }
                  break;

                default:
              }
            }

            const callName = moveCallTxnName(transaction.target).split('::');
            actions.push({
              type: IDecodedTxActionType.FUNCTION_CALL,
              'functionCall': {
                target: `${callName?.[1]}::${callName?.[2]}`,
                // functionName: data.packageObjectId ?? '',
                functionName: callName?.[0] ?? '',
                args,
                extraInfo: null,
              },
            });
            break;
          }
          case 'MakeMoveVec':
          case 'SplitCoins':
          case 'MergeCoins':
            break;
          default:
            actions.push({
              type: IDecodedTxActionType.UNKNOWN,
              direction: IDecodedTxDirection.OTHER,
              unknownAction: {
                extraInfo: {},
              },
            });
            break;
        }
      }
    } catch (e) {
      // ignore
    }

    const result: IDecodedTx = {
      txid: '',
      owner: dbAccount.address,
      signer: dbAccount.address,
      nonce: 0,
      actions,
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      feeInfo: {
        price: convertFeeValueToGwei({
          value: '1',
          network,
        }),
        limit: gasLimit,
      },
      extraInfo: null,
      encodedTx,
    };

    return Promise.resolve(result);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxSUI> {
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const { to, amount, token: tokenAddress } = transferInfo;
    const { address: from } = await this.getDbAccount();

    let amountValue: string;

    const recipient = addHexPrefix(to);
    const sender = addHexPrefix(from);
    const isSuiTransfer = tokenAddress == null || isEmpty(tokenAddress);

    if (isSuiTransfer) {
      const network = await this.getNetwork();
      amountValue = new BigNumber(amount).shiftedBy(network.decimals).toFixed();
    } else {
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        tokenAddress,
      );

      if (typeof token === 'undefined') {
        throw new OneKeyInternalError('Failed to get token info.');
      }

      amountValue = new BigNumber(amount).shiftedBy(token.decimals).toFixed();
    }

    const client = await this.getClient();

    const typeArg = isSuiTransfer ? SUI_NATIVE_COIN : tokenAddress;

    const transaction = await createCoinSendTransaction({
      client,
      address: sender,
      to: recipient,
      amount: amountValue,
      coinType: normalizeSuiCoinType(typeArg),
    });

    return {
      rawTx: transaction.serialize(),
    };
  }

  override buildEncodedTxFromApprove(
    _approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override updateEncodedTxTokenApprove(
    _encodedTx: IEncodedTx,
    _amount: string,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override async updateEncodedTx(
    encodedTx: IEncodedTxSUI,
    payload: IEncodedTxUpdatePayloadTransfer,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxSUI> {
    // max native token transfer update
    if (options.type === 'transfer') {
      const { rawTx } = encodedTx;
      const oldTx = TransactionBlock.from(rawTx);

      const transferObject = oldTx.blockData.transactions.find((transaction) =>
        transaction.kind === 'TransferObjects' ? transaction : undefined,
      );

      if (!transferObject || transferObject.kind !== 'TransferObjects')
        return Promise.resolve(encodedTx);

      const client = await this.getClient();
      const newTx = await createCoinSendTransaction({
        client,
        address: oldTx.blockData.sender ?? (await this.getAccountAddress()),
        to: get(transferObject.address, 'value'),
        amount: payload.amount,
        coinType: SUI_NATIVE_COIN,
        isPayAllSui: true,
      });

      return {
        ...encodedTx,
        rawTx: newTx.serialize(),
      };
    }

    return Promise.resolve(encodedTx);
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxSUI,
  ): Promise<IUnsignedTxPro> {
    const newEncodedTx = encodedTx;

    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    return Promise.resolve({
      inputs: [
        {
          address: stripHexPrefix(dbAccount.address),
          value: new BigNumber(0),
          publicKey: stripHexPrefix(dbAccount.pub),
        },
      ],
      outputs: [],
      payload: { encodedTx: newEncodedTx },
      encodedTx: newEncodedTx,
    });
  }

  async tryFixFeePayment(encodedTx: IEncodedTxSUI): Promise<IEncodedTxSUI> {
    const tx = TransactionBlock.from(encodedTx.rawTx);

    if (!tx.blockData.gasConfig.payment) {
      const client = await this.getClient();
      const sender = await this.getAccountAddress();

      const allCoins = await getAllCoins(client, sender, null);

      const tempCoin = allCoins[0];

      tx.blockData.gasConfig.payment = [
        {
          objectId: tempCoin.coinObjectId,
          version: tempCoin.version,
          digest: tempCoin.digest,
        },
      ];

      const tempEncodedTx: IEncodedTxSUI = {
        rawTx: TransactionBlock.from(tx.serialize()).serialize(),
      };

      const feeInfo = await this.fetchFeeInfo(tempEncodedTx);

      // Use all coins to cobble together processing fees
      const gasLimit = new BigNumber(feeInfo.limit ?? '0').toNumber();
      const selectCoins = [];

      let total = new BigNumber(0);
      do {
        const coin = allCoins.shift();
        if (coin) {
          const amount = new BigNumber(coin?.balance ?? '0');
          total = total.plus(amount);
          selectCoins.push(coin);
        } else {
          throw new OneKeyInternalError('Insufficient balance');
        }
      } while (total.isLessThan(gasLimit));

      tx.blockData.gasConfig.payment = selectCoins.map((coin) => ({
        objectId: coin.coinObjectId,
        version: coin.version,
        digest: coin.digest,
      }));

      return {
        ...encodedTx,
        rawTx: TransactionBlock.from(tx.serialize()).serialize(),
      };
    }

    return encodedTx;
  }

  async fetchFeeInfo(encodedTx: IEncodedTxSUI): Promise<IFeeInfo> {
    const client = await this.getClient();

    const network = await this.getNetwork();

    // https://github.com/MystenLabs/sui/blob/f32877f2e40d35a008710c232e49b57aab886462/crates/sui-types/src/messages.rs#L338
    // see objectid 0x5 reference_gas_price
    const price = convertFeeValueToGwei({ value: '1', network });
    let limit: string;

    try {
      const tx = TransactionBlock.from(encodedTx.rawTx);

      const simulationTx = (
        await dryRunTransactionBlock({
          provider: client,
          sender: await this.getAccountAddress(),
          transactionBlock: tx,
        })
      ).effects;

      if (simulationTx) {
        const computationCost = simulationTx?.gasUsed?.computationCost || '0';
        const storageCost = simulationTx.gasUsed?.storageCost || '0';
        const storageRebate = simulationTx.gasUsed?.storageRebate || '0';

        const safeOverhead = new BigNumber(GAS_SAFE_OVERHEAD).multipliedBy(1);

        const baseComputationCostWithOverhead = new BigNumber(
          computationCost,
        ).plus(safeOverhead);

        const gasBudget = baseComputationCostWithOverhead
          .plus(storageCost)
          .minus(storageRebate);

        // Set the budget to max(computation, computation + storage - rebate)
        const gasUsed = gasBudget.gt(baseComputationCostWithOverhead)
          ? gasBudget
          : baseComputationCostWithOverhead;

        // Only onekey max send can pass, other cases must be simulated successfully
        if (gasUsed.isEqualTo(0)) {
          // Exec failure
          throw new OneKeyError();
        }

        limit = gasUsed.multipliedBy(1.1).toFixed();
      } else {
        throw new OneKeyError();
      }
    } catch (error) {
      const transactionBlock = TransactionBlock.from(encodedTx.rawTx);

      const existsPaySui = transactionBlock.blockData.transactions.some(
        (txn) => txn.kind === 'TransferObjects',
      );

      if (existsPaySui) {
        const { inputs } = transactionBlock.blockData;
        limit = computeGasBudget(inputs.length).toString();
      } else {
        throw new OneKeyError();
      }
    }

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit,
      prices: [price],
      defaultPresetIndex: '0',
    };
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    const client = await this.getClient();

    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    try {
      const { signature, signatureScheme, publicKey } = signedTx;

      let scheme: SignatureScheme = 'ED25519';
      switch (signatureScheme) {
        case 'ed25519':
          scheme = 'ED25519';
          break;
        case 'secp256k1':
          scheme = 'Secp256k1';
          break;
        default:
          throw new OneKeyInternalError('Unsupported signature scheme');
      }

      if (!signature) {
        throw new Error('signature is empty');
      }
      if (!publicKey) {
        throw new Error('publicKey is empty');
      }

      const transactionResponse = await client.executeTransactionBlock({
        transactionBlock: signedTx.rawTx,
        signature,
        requestType: (signedTx.encodedTx as IEncodedTxSUI).requestType,
      });

      const txid = getTransactionDigest(transactionResponse);

      debugLogger.engine.info('broadcastTransaction Done:', {
        txid,
        rawTx: signedTx.rawTx,
        transactionResponse,
      });

      return {
        ...signedTx,
        txid,
      };
    } catch (error: any) {
      const { errorCode, message }: { errorCode: any; message: string } =
        error || {};

      // payAllSui problem https://github.com/MystenLabs/sui/issues/6364
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const errorMessage = `${errorCode ?? ''} ${message}`;
      if (message.indexOf('Insufficient gas:') !== -1) {
        throw new OneKeyInternalError(
          errorMessage,
          'msg__broadcast_tx_Insufficient_fee',
        );
      } else {
        throw new OneKeyInternalError(errorMessage);
      }
    }
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

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [], tokenIdOnNetwork } = options;
    if (tokenIdOnNetwork) {
      // No token support now.
      return Promise.resolve([]);
    }

    const client = await this.getClient();
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);

    const fromTransactions = await client.queryTransactionBlocks({
      filter: {
        FromAddress: dbAccount.address,
      },
      limit: 20,
      order: 'descending',
    });
    const toTransactions = await client.queryTransactionBlocks({
      filter: {
        ToAddress: dbAccount.address,
      },
      limit: 20,
      order: 'descending',
    });

    const fromTransactionsIds = fromTransactions.data.map((tx) => tx.digest);
    const toTransactionsIds = toTransactions.data.map((tx) => tx.digest);

    const transactions = [...fromTransactionsIds, ...toTransactionsIds];
    if (!transactions || !transactions.length) {
      return [];
    }

    const explorerTxs = await client.multiGetTransactionBlocks({
      digests: deduplicate(transactions),
      options: {
        showInput: true,
        showEffects: true,
      },
    });

    const promises = explorerTxs.map(async (tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === getTransactionDigest(tx),
      );
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        // No need to update.
        return Promise.resolve(null);
      }

      try {
        let nativeToken: Token | undefined =
          await this.engine.getNativeTokenInfo(this.networkId);

        const executionStatus = getExecutionStatus(tx);
        const isSuccess = executionStatus?.status === 'success';
        const isFailure = executionStatus?.status === 'failure';

        const transaction = tx;
        if (!transaction)
          throw new Error('current transaction is empty, continue');

        const timestamp =
          getTimestampFromTransactionResponse(tx) ?? getTimeStamp();

        const transactionData = getTransaction(tx)?.data?.transaction;
        const payments = getTransaction(tx)?.data?.gasData.payment;

        if (
          !transactionData ||
          transactionData.kind !== 'ProgrammableTransaction'
        ) {
          throw new Error('current transaction is empty, continue');
        }

        const transactionActions = transactionData.transactions;
        const from = getTransactionSender(tx) ?? '';

        const actions: IDecodedTxAction[] = [];

        let to = '';

        await Promise.all(
          transactionActions.map(async (action) => {
            let amount: BigNumber = new BigNumber('0');

            if ('TransferObjects' in action) {
              let actionKey = 'nativeTransfer';
              let actionType = IDecodedTxActionType.NATIVE_TRANSFER;

              const details = await parseTransferObjects({
                argument: action.TransferObjects,
                actions: transactionActions,
                inputs: transactionData.inputs,
                payments,
                client,
              });

              to = details.receive;
              if (details.amounts.has(GAS_TYPE_ARG)) {
                actionKey = 'nativeTransfer';
                actionType = IDecodedTxActionType.NATIVE_TRANSFER;
                amount = new BigNumber(
                  details.amounts.get(GAS_TYPE_ARG)?.toString() ?? '0',
                );
              } else {
                actionKey = 'tokenTransfer';
                actionType = IDecodedTxActionType.TOKEN_TRANSFER;
                // read the first token amount
                for (const [key, value] of details.amounts.entries()) {
                  amount = new BigNumber(value.toString());
                  actionKey = 'tokenTransfer';

                  nativeToken = await this.engine.ensureTokenInDB(
                    this.networkId,
                    key,
                  );
                }
              }

              if (!nativeToken) return null;

              actions.push({
                type: actionType,
                [actionKey]: {
                  tokenInfo: nativeToken,
                  from,
                  to,
                  amount: new BigNumber(amount ?? '0')
                    .shiftedBy(-nativeToken.decimals)
                    .toFixed(),
                  amountValue: amount?.toString() ?? '0',
                  extraInfo: null,
                },
              });
            } else if ('MoveCall' in action) {
              const moveCall = action.MoveCall;
              let functionName = '';
              if (moveCall.package && typeof moveCall.package === 'object') {
                // @ts-expect-error
                functionName = moveCall.package?.objectId ?? '';
              } else {
                functionName = moveCall.package;
              }
              const args: string[] = [];
              for (const arg of moveCall.arguments ?? []) {
                if (typeof arg === 'object') {
                  if ('Input' in arg) {
                    const result = arg.Input;
                    const input = transactionData.inputs[result];
                    if (input.type === 'pure') {
                      args.push(input.value.toString());
                    } else if (input.type === 'object') {
                      args.push(input.objectId);
                    }
                  } else if ('Result' in arg) {
                    const result = arg.Result;
                    const input = transactionData.inputs[result];
                    if (input.type === 'pure') {
                      args.push(input.value.toString());
                    } else if (input.type === 'object') {
                      args.push(input.objectId);
                    }
                  } else if ('NestedResult' in arg) {
                    const [index] = arg.NestedResult;
                    const input = transactionData.inputs[index];
                    if (input.type === 'pure') {
                      args.push(input.value.toString());
                    } else if (input.type === 'object') {
                      args.push(input.objectId);
                    }
                  }
                }
              }
              actions.push({
                type: IDecodedTxActionType.FUNCTION_CALL,
                'functionCall': {
                  target: moveCallTxnName(moveCall.function),
                  functionName,
                  args,
                  extraInfo: null,
                },
              });
            } else if ('SplitCoins' in action || 'MergeCoins' in action) {
              // ignore
            } else if ('MakeMoveVec' in action) {
              // ignore
            } else {
              actions.push({
                type: IDecodedTxActionType.UNKNOWN,
                direction: IDecodedTxDirection.OTHER,
                unknownAction: {
                  extraInfo: {},
                },
              });
            }
          }),
        );

        const encodedTx = {
          from,
          to,
          value: '',
        };

        const feeValue = getTotalGasUsed(tx)?.toString() ?? '0';

        let status = IDecodedTxStatus.Pending;
        if (isFailure) {
          status = IDecodedTxStatus.Failed;
        } else if (isSuccess) {
          status = IDecodedTxStatus.Confirmed;
        }

        const txid = getTransactionDigest(tx);

        const decodedTx: IDecodedTx = {
          txid,
          owner: dbAccount.address,
          signer: from,
          nonce: 0,
          actions,
          status,
          networkId: this.networkId,
          accountId: this.accountId,
          encodedTx,
          extraInfo: null,
          totalFeeInNative: new BigNumber(feeValue)
            .shiftedBy(-decimals)
            .toFixed(),
        };
        if (typeof timestamp === 'number') {
          decodedTx.updatedAt = timestamp;
        } else if (typeof timestamp === 'string') {
          decodedTx.updatedAt = parseInt(timestamp);
        }
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
        decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
        return await this.buildHistoryTx({
          decodedTx,
          historyTxToMerge,
        });
      } catch (e) {
        debugLogger.common.error(e);
      }

      return Promise.resolve(null);
    });

    return (await Promise.all(promises)).filter(Boolean);
  }

  override async getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    const client = await this.getClient();

    const txs = await client.multiGetTransactionBlocks({
      digests: txids,
    });

    const txStatuses = new Map<string, TransactionStatus>();

    txs.forEach(async (tx) => {
      const txid = getTransactionDigest(tx);
      try {
        const executionStatus = getExecutionStatus(tx);
        const isSuccess = executionStatus?.status === 'success';
        const isFailure = executionStatus?.status === 'failure';

        let status = TransactionStatus.PENDING;
        if (isFailure) {
          status = TransactionStatus.CONFIRM_BUT_FAILED;
        } else if (isSuccess) {
          status = TransactionStatus.CONFIRM_AND_SUCCESS;
        }
        txStatuses.set(txid, status);
      } catch (error: any) {
        const { message }: { message: string } = error;
        if (
          message.indexOf('Could not find the referenced transaction') !== -1
        ) {
          txStatuses.set(txid, TransactionStatus.NOT_FOUND);
        }
      }
    });

    return txids.map((txid) => txStatuses.get(txid));
  }

  async getTransactionByTxId(
    txid: string,
    options?: SuiTransactionBlockResponseOptions,
  ): Promise<SuiTransactionBlockResponse | undefined> {
    const client = await this.getClient();
    const tx = await client.getTransactionBlock({
      digest: txid,
      options,
    });
    return tx;
  }

  async waitPendingTransaction(
    txId: string,
    options?: SuiTransactionBlockResponseOptions,
  ): Promise<SuiTransactionBlockResponse | undefined> {
    const client = await this.getClient();
    return waitPendingTransaction(client, txId, options);
  }
}
