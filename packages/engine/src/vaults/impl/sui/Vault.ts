/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import {
  Base64DataBuffer,
  Coin,
  Ed25519PublicKey,
  LocalTxnDataSerializer,
  getCertifiedTransaction,
  getExecutionStatus,
  getMoveCallTransaction,
  getObjectExistsResponse,
  getObjectId,
  getPayAllSuiTransaction,
  getPaySuiTransaction,
  getPayTransaction,
  getPublishTransaction,
  getTimestampFromTransactionResponse,
  getTotalGasUsed,
  getTransactionData,
  getTransactionDigest,
  getTransactionSender,
  getTransactions,
  getTransferObjectTransaction,
  getTransferSuiTransaction,
  isValidSuiAddress,
} from '@mysten/sui.js';
import { hexToBytes } from '@noble/hashes/utils';
import BigNumber from 'bignumber.js';
import { groupBy, isArray, isEmpty } from 'lodash';
import memoizee from 'memoizee';

import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type { PartialTokenInfo } from '@onekeyhq/engine/src/types/provider';
import type { Token } from '@onekeyhq/kit/src/store/typings';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

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
} from '../../types';
import { convertFeeValueToGwei } from '../../utils/feeInfoUtils';
import { addHexPrefix, stripHexPrefix } from '../../utils/hexUtils';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { QueryJsonRpcProvider } from './provider/QueryJsonRpcProvider';
import settings from './settings';
import {
  GAS_TYPE_ARG,
  SUI_NATIVE_COIN,
  computeGasBudget,
  computeGasBudgetForPay,
  decodeActionAllPay,
  decodeActionPay,
  decodeActionPayTransaction,
  decodeBytesTransaction,
  deduplicate,
  getTxnAmount,
  moveCallTxnName,
  toTransaction,
} from './utils';

import type { DBSimpleAccount } from '../../../types/account';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxSUI } from './types';
import type {
  ExportedKeypair,
  GetObjectDataResponse,
  Keypair,
  SignatureScheme,
  SuiMoveObject,
  SuiObject,
  SuiTransactionResponse,
  UnserializedSignableTransaction,
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
    return new QueryJsonRpcProvider(url, {
      faucetURL: 'https://faucet.testnet.sui.io/gas',
    });
  }

  // Chain only methods

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = await this.getClientCache(url);

    const start = performance.now();
    const latestBlock = await client.getTotalTransactionNumber();
    return {
      responseTime: Math.floor(performance.now() - start),
      latestBlock,
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

    const accountData = await client.getObject(stripHexPrefix(address));
    return accountData.status === 'Exists';
  }

  async getObjectsOwnedByAddress(
    address: string,
    typeArg?: string,
  ): Promise<Record<string, bigint>> {
    const client = await this.getClient();

    const allObjRes = await client.getCoinBalancesOwnedByAddress(
      address,
      typeArg,
    );

    const allSuiObjects: SuiObject[] = [];
    for (const objRes of allObjRes) {
      const suiObj = getObjectExistsResponse(objRes);
      if (suiObj) {
        allSuiObjects.push(suiObj);
      }
    }

    return allSuiObjects
      .map((aCoin) => aCoin.data as SuiMoveObject)
      .reduce((acc, aCoin) => {
        const coinType = Coin.getCoinTypeArg(aCoin);
        if (coinType) {
          if (typeof acc[coinType] === 'undefined') {
            acc[coinType] = BigInt(0);
          }
          acc[coinType] += Coin.getBalance(aCoin) ?? BigInt(0);
        }
        return acc;
      }, {} as Record<string, bigint>);
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const requestAddress = groupBy(requests, (request) => request.address);

    const balances = new Map<string, BigNumber>();
    await Promise.all(
      Object.entries(requestAddress).map(async ([address, tokens]) => {
        try {
          const resources = await this.getObjectsOwnedByAddress(address);

          tokens.forEach((req) => {
            const { tokenAddress } = req;
            const typeTag = tokenAddress ?? SUI_NATIVE_COIN;
            const balance = resources[typeTag]?.toString() ?? '0';
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
          const coinInfo = await client.getCoinMetadata(tokenAddress);

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

    const { data } = params.encodedTx;
    if (data && 'gasBudget' in data) {
      data.gasBudget = parseInt(limit);
    }

    return Promise.resolve(params.encodedTx);
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

    let txData: UnserializedSignableTransaction;

    if (encodedTx.kind === 'bytes') {
      try {
        const ser = new LocalTxnDataSerializer(await this.getClient());
        const decode =
          await ser.deserializeTransactionBytesToSignableTransaction(
            true,
            new Base64DataBuffer(decodeBytesTransaction(encodedTx.data)),
          );
        if (isArray(decode)) {
          [txData] = decode;
        } else {
          txData = decode;
        }
      } catch (e) {
        throw new OneKeyError('Invalid transaction data.');
      }
    } else {
      txData = encodedTx;
    }

    if (!txData) throw new OneKeyError('Invalid transaction data.');

    const actions: IDecodedTxAction[] = [];

    const { kind, data } = txData;
    let gasLimit = 0;
    if (data && 'gasBudget' in data) {
      gasLimit = data.gasBudget;
    }

    switch (kind) {
      case 'pay':
        // eslint-disable-next-line no-case-declarations
        const action = await decodeActionPayTransaction(client, data);
        if (action) {
          let actionKey = 'nativeTransfer';
          if (!action.isNative) {
            actionKey = 'tokenTransfer';
            if (!action.coinType)
              throw new OneKeyInternalError('Invalid coin type');
            token = await this.engine.ensureTokenInDB(
              this.networkId,
              action.coinType,
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

      case 'transferSui':
        actions.push({
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          'nativeTransfer': {
            tokenInfo: token,
            from: sender,
            to: data.recipient,
            amount: new BigNumber(data.amount ?? '0')
              .shiftedBy(-token.decimals)
              .toFixed(),
            amountValue: data.amount?.toString() ?? '0',
            extraInfo: null,
          },
        });
        break;

      case 'paySui':
        // eslint-disable-next-line no-case-declarations
        const toAddress = new Map<string, BigNumber>();
        for (let i = 0; i < data.recipients.length; i += 1) {
          const recipient = data.recipients[i];
          const amount = data.amounts[i];

          toAddress.set(
            recipient,
            (toAddress.get(recipient) ?? new BigNumber(0)).plus(
              new BigNumber(amount),
            ),
          );
        }

        for (const [recipient, amount] of toAddress.entries()) {
          actions.push({
            type: IDecodedTxActionType.NATIVE_TRANSFER,
            'nativeTransfer': {
              tokenInfo: token,
              from: sender,
              to: recipient,
              amount: amount.shiftedBy(-token.decimals).toFixed(),
              amountValue: amount.toString(),
              extraInfo: null,
            },
          });
        }
        break;

      case 'payAllSui':
        actions.push({
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          'nativeTransfer': {
            tokenInfo: token,
            from: sender,
            to: data.recipient,
            // Todo get balance
            amount: 'All',
            amountValue: 'All',
            extraInfo: null,
          },
        });
        break;

      case 'moveCall':
        actions.push({
          type: IDecodedTxActionType.FUNCTION_CALL,
          'functionCall': {
            target: moveCallTxnName(data.function),
            functionName: data.packageObjectId ?? '',
            args: data.arguments ?? [],
            extraInfo: null,
          },
        });
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
        limit: gasLimit?.toString(),
      },
      extraInfo: null,
      encodedTx,
    };

    return Promise.resolve(result);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxSUI> {
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
    const readyCoins = await client.getCoinBalancesOwnedByAddress(
      sender,
      typeArg,
    );
    const totalBalance = Coin.totalBalance(readyCoins);
    const gasBudget = computeGasBudgetForPay(readyCoins, amountValue);

    let amountAndGasBudget = isSuiTransfer
      ? BigInt(amountValue) + BigInt(gasBudget)
      : BigInt(amountValue);
    if (amountAndGasBudget > totalBalance) {
      amountAndGasBudget = totalBalance;
    }

    const inputCoins = Coin.selectCoinSetWithCombinedBalanceGreaterThanOrEqual(
      readyCoins,
      amountAndGasBudget,
    ) as GetObjectDataResponse[];

    if (inputCoins.length === 0) {
      throw new InsufficientBalance();
    }

    const selectCoinIds = inputCoins.map((object) => getObjectId(object));

    const txCommon = {
      inputCoins: selectCoinIds,
      recipients: [recipient],
      amounts: [parseInt(amountValue)],
      gasBudget,
    };

    let encodedTx: IEncodedTxSUI;
    if (isSuiTransfer) {
      encodedTx = {
        kind: 'paySui',
        data: {
          ...txCommon,
        },
      };
    } else {
      // Get native coin objects
      const gasFeeCoins = await client.selectCoinsWithBalanceGreaterThanOrEqual(
        sender,
        BigInt(gasBudget),
        GAS_TYPE_ARG,
      );

      const gasCoin = Coin.selectCoinWithBalanceGreaterThanOrEqual(
        gasFeeCoins,
        BigInt(gasBudget),
      ) as GetObjectDataResponse | undefined;

      if (!gasCoin) {
        throw new OneKeyInternalError('Failed to get gas coin.');
      }

      encodedTx = {
        kind: 'pay',
        data: {
          ...txCommon,
          gasPayment: getObjectId(gasCoin),
        },
      };
    }

    return encodedTx;
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
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxSUI> {
    // max native token transfer update
    if (options.type === 'transfer' && encodedTx.kind === 'paySui') {
      const { data } = encodedTx;
      // Multiple transfers don't count
      if (data.recipients.length === 1) {
        return Promise.resolve({
          kind: 'payAllSui',
          data: {
            // TODO: Don't have to flip it, wait for official restoration
            inputCoins: data.inputCoins.reverse(),
            recipient: data.recipients[0],
            gasBudget: data.gasBudget,
          },
        });
      }
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

  async fetchFeeInfo(encodedTx: IEncodedTxSUI): Promise<IFeeInfo> {
    const client = await this.getClient();

    const [network, unsignedTx] = await Promise.all([
      this.getNetwork(),
      this.buildUnsignedTxFromEncodedTx(encodedTx),
    ]);

    // https://github.com/MystenLabs/sui/blob/f32877f2e40d35a008710c232e49b57aab886462/crates/sui-types/src/messages.rs#L338
    // see objectid 0x5 reference_gas_price
    const price = convertFeeValueToGwei({ value: '1', network });
    let limit: string;

    if (encodedTx.kind === 'bytes') {
      try {
        const ser = new LocalTxnDataSerializer(await this.getClient());
        const decode =
          await ser.deserializeTransactionBytesToSignableTransaction(
            true,
            new Base64DataBuffer(decodeBytesTransaction(encodedTx.data)),
          );
        let data;
        if (isArray(decode)) {
          data = decode[0].data;
        } else {
          data = decode.data;
        }
        if ('gasBudget' in data) {
          return {
            disableEditFee: true,
            nativeSymbol: network.symbol,
            nativeDecimals: network.decimals,
            feeSymbol: network.feeSymbol,
            feeDecimals: network.feeDecimals,

            limit: data.gasBudget?.toString(),
            prices: [price],
            defaultPresetIndex: '0',
          };
        }
      } catch (e) {
        // ignore
      }
    }

    const txnBytes = await toTransaction(
      client,
      await this.getAccountAddress(),
      unsignedTx.encodedTx as IEncodedTxSUI,
    );

    const newEncodedTx = unsignedTx.encodedTx as IEncodedTxSUI;
    try {
      const simulationTx = await client.dryRunTransaction(txnBytes);

      if (simulationTx) {
        const computationCost = simulationTx?.gasUsed?.computationCost || 0;
        const storageCost = simulationTx.gasUsed?.storageCost || 0;
        const storageRebate = simulationTx.gasUsed?.storageRebate || 0;

        const gasUsed = new BigNumber(
          computationCost + storageCost - storageRebate,
        );
        // Only onekey max send can pass, other cases must be simulated successfully
        if (gasUsed.isEqualTo(0)) {
          // Exec failure
          throw new OneKeyError();
        }

        limit = gasUsed.multipliedBy(2).toFixed();
      } else {
        throw new OneKeyError();
      }
    } catch (error) {
      if (newEncodedTx.kind === 'paySui') {
        const { data } = newEncodedTx;
        limit = computeGasBudget(data.inputCoins.length).toString();
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

      const transactionResponse = await client.executeTransaction(
        new Base64DataBuffer(signedTx.rawTx),
        scheme,
        new Base64DataBuffer(hexToBytes(stripHexPrefix(signature))),
        new Ed25519PublicKey(hexToBytes(stripHexPrefix(publicKey))),
      );

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

    const transactions = await client.getTransactionsForAddress(
      dbAccount.address,
    );
    if (!transactions || !transactions.length) {
      return [];
    }

    const explorerTxs = await client.getTransactionWithEffectsBatch(
      deduplicate(transactions),
    );

    const promises = explorerTxs.map(async (tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === getTransactionDigest(tx),
      );
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        // No need to update.
        return Promise.resolve(null);
      }

      try {
        const nativeToken: Token | undefined =
          await this.engine.getNativeTokenInfo(this.networkId);

        const executionStatus = getExecutionStatus(tx);
        const isSuccess = executionStatus?.status === 'success';
        const isFailure = executionStatus?.status === 'failure';

        const transaction = getCertifiedTransaction(tx);
        if (!transaction)
          throw new Error('current transaction is empty, continue');

        const timestamp = getTimestampFromTransactionResponse(tx);
        const transactionData = getTransactionData(transaction);
        const transactionActions = getTransactions(transaction);
        const from = getTransactionSender(transaction);

        const actions: IDecodedTxAction[] = [];

        let to = '';

        await Promise.all(
          transactionActions.map(async (action) => {
            const amountByRecipient = getTxnAmount(action);
            const amount: bigint =
              typeof amountByRecipient === 'bigint'
                ? amountByRecipient
                : Object.values(amountByRecipient || {})[0];

            const transferObject = getTransferObjectTransaction(action);
            if (transferObject) {
              // NFT and more types of transfer
            }

            const publish = getPublishTransaction(action);
            if (publish) {
              // publish contract
            }

            const moveCall = getMoveCallTransaction(action);
            if (moveCall) {
              actions.push({
                type: IDecodedTxActionType.FUNCTION_CALL,
                'functionCall': {
                  target: moveCallTxnName(moveCall.function),
                  functionName: moveCall.package?.objectId ?? '',
                  args: moveCall.arguments ?? [],
                  extraInfo: null,
                },
              });
              return true; // continue
            }

            const transferSui = getTransferSuiTransaction(action);
            if (transferSui) {
              to = transferSui.recipient;
              actions.push({
                type: IDecodedTxActionType.NATIVE_TRANSFER,
                'nativeTransfer': {
                  tokenInfo: nativeToken,
                  from,
                  to,
                  amount: new BigNumber(amount.toString())
                    .shiftedBy(-nativeToken.decimals)
                    .toFixed(),
                  amountValue: amount.toString(),
                  extraInfo: null,
                },
              });
              return true; // continue
            }

            const pay = getPayTransaction(action);
            const actionPay = await decodeActionPay(client, pay);
            if (pay && actionPay) {
              if (actionPay) {
                to = actionPay.recipient;
                let actionKey = 'nativeTransfer';
                let tokenInfo: Token | undefined = nativeToken;
                if (!actionPay.isNative) {
                  actionKey = 'tokenTransfer';
                  if (!actionPay.coinType)
                    throw new OneKeyInternalError('Invalid coin type');
                  tokenInfo = await this.engine.ensureTokenInDB(
                    this.networkId,
                    actionPay.coinType,
                  );

                  if (!tokenInfo)
                    throw new OneKeyInternalError('Invalid coin type');
                }
                actions.push({
                  type: actionPay.type,
                  [actionKey]: {
                    tokenInfo,
                    from,
                    to,
                    amount: new BigNumber(actionPay.amount ?? '0')
                      .shiftedBy(-tokenInfo.decimals)
                      .toFixed(),
                    amountValue: actionPay.amount?.toString() ?? '0',
                    extraInfo: null,
                  },
                });
              }
              return true; // continue
            }

            const paySui = getPaySuiTransaction(action);
            if (paySui) {
              to = paySui.recipients[0] ?? '';

              if (typeof amountByRecipient === 'bigint') {
                actions.push({
                  type: IDecodedTxActionType.NATIVE_TRANSFER,
                  'nativeTransfer': {
                    tokenInfo: nativeToken,
                    from,
                    to,
                    amount: new BigNumber(amount.toString())
                      .shiftedBy(-nativeToken.decimals)
                      .toFixed(),
                    amountValue: amount.toString(),
                    extraInfo: null,
                  },
                });
              } else {
                const keys = Object.keys(amountByRecipient || {});

                keys.forEach((key) => {
                  const value = amountByRecipient[key];
                  if (!value) return true;
                  actions.push({
                    type: IDecodedTxActionType.NATIVE_TRANSFER,
                    'nativeTransfer': {
                      tokenInfo: nativeToken,
                      from,
                      to,
                      amount: new BigNumber(value.toString())
                        .shiftedBy(-nativeToken.decimals)
                        .toFixed(),
                      amountValue: value.toString(),
                      extraInfo: null,
                    },
                  });
                });
              }

              return true; // continue
            }

            const paySuiAll = getPayAllSuiTransaction(action);
            const decodePaySuiAll = await decodeActionAllPay(client, paySuiAll);
            if (paySuiAll && decodePaySuiAll) {
              to = paySuiAll.recipient;

              actions.push({
                type: IDecodedTxActionType.NATIVE_TRANSFER,
                'nativeTransfer': {
                  tokenInfo: nativeToken,
                  from,
                  to,
                  amount: new BigNumber(decodePaySuiAll.amount.toString())
                    .shiftedBy(-nativeToken.decimals)
                    .toFixed(),
                  amountValue: decodePaySuiAll.amount.toString(),
                  extraInfo: null,
                },
              });
              return true; // continue
            }

            actions.push({
              type: IDecodedTxActionType.UNKNOWN,
              direction: IDecodedTxDirection.OTHER,
              unknownAction: {
                extraInfo: {},
              },
            });
          }),
        );

        const encodedTx = {
          from,
          to,
          value: '',
        };

        const feeValue = getTotalGasUsed(tx) ?? '0';

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
        decodedTx.updatedAt = timestamp;
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

    const txs = await client.getTransactionWithEffectsBatch(txids);

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
  ): Promise<SuiTransactionResponse | undefined> {
    const client = await this.getClient();
    const tx = await client.getTransactionWithEffects(txid);
    return tx;
  }
}
