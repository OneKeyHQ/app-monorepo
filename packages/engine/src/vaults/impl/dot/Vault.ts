/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { TransactionStatus } from '@onekeyfe/blockchain-libs/dist/types/provider';
import { ApiPromise, HttpProvider } from '@polkadot/api';
import { EXTRINSIC_VERSION } from '@polkadot/types/extrinsic/v4/Extrinsic';
import {
  hexToU8a,
  u8aConcat,
  u8aToHex,
  u8aToU8a,
  u8aWrapBytes,
} from '@polkadot/util';
import {
  construct,
  createMetadata,
  decode,
  getRegistry,
  methods,
} from '@substrate/txwrapper-polkadot';
import BigNumber from 'bignumber.js';
import { get, groupBy } from 'lodash';
import memoizee from 'memoizee';

import {
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/engine/src/errors';
import type { DBVariantAccount } from '@onekeyhq/engine/src/types/account';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { KeyringSoftwareBase } from '@onekeyhq/engine/src/vaults/keyring/KeyringSoftwareBase';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionTokenTransfer,
  IDecodedTxLegacy,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
} from '@onekeyhq/engine/src/vaults/types';
import { convertFeeValueToGwei } from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';
import {
  addHexPrefix,
  stripHexPrefix,
} from '@onekeyhq/engine/src/vaults/utils/hexUtils';
import { VaultBase } from '@onekeyhq/engine/src/vaults/VaultBase';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { accountIdToAddress } from './sdk/address';
import settings from './settings';
import { SubScanClient } from './substrate/query/subscan';
import { getTransactionType, getTransactionTypeFromTxInfo } from './utils';

import type { ExtrinsicParam } from './substrate/query/subscan/type';
import type { DotImplOptions, IEncodedTxDot } from './types';
import type { BaseClient } from '@onekeyfe/blockchain-libs/dist/provider/abc';
import type { Metadata } from '@polkadot/types';
import type { BlockHash, RuntimeVersion } from '@polkadot/types/interfaces';
import type { TypeRegistry } from '@substrate/txwrapper-polkadot';

const SIG_TYPE_NONE = new Uint8Array();
export const TYPE_PREFIX = {
  ecdsa: new Uint8Array([2]),
  ed25519: new Uint8Array([0]),
  ethereum: new Uint8Array([2]),
  sr25519: new Uint8Array([1]),
};

// @ts-ignore
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  cache: Record<string, any> = {};

  settings = settings;

  rpcRuntimeVersion: RuntimeVersion | null = null;

  genesisHash: BlockHash | null = null;

  MetadataRpc: Metadata | null = null;

  getNodeClient(url: string) {
    const httpProvider = new HttpProvider(url);
    // const httpProvider = new WsProvider('wss://rpc.polkadot.io');
    return ApiPromise.create({
      provider: httpProvider,
    });
  }

  getClientCache = memoizee(async (rpcUrl) => this.getNodeClient(rpcUrl), {
    promise: true,
    max: 1,
  });

  getScanClientCache = memoizee(async () => new SubScanClient(), {
    promise: true,
    max: 1,
  });

  getRPCRuntimeVersionCache = memoizee(
    async (): Promise<RuntimeVersion> => {
      if (this.rpcRuntimeVersion) return this.rpcRuntimeVersion;
      const client = await this.getClient();
      this.rpcRuntimeVersion = await client.rpc.state.getRuntimeVersion();
      return this.rpcRuntimeVersion;
    },
    {
      promise: true,
      max: 1,
    },
  );

  getGenesisHashCache = memoizee(
    async (): Promise<BlockHash> => {
      if (this.genesisHash) return this.genesisHash;
      const client = await this.getClient();
      this.genesisHash = await client.rpc.chain.getBlockHash(0);
      return this.genesisHash;
    },
    {
      promise: true,
      max: 1,
    },
  );

  getMetadataRpcCache = memoizee(
    async (): Promise<Metadata> => {
      if (this.MetadataRpc) return this.MetadataRpc;
      const client = await this.getClient();
      this.MetadataRpc = await client.rpc.state.getMetadata();
      return this.MetadataRpc;
    },
    {
      promise: true,
      max: 1,
    },
  );

  getRegistryCache = memoizee(
    async (): Promise<TypeRegistry> => {
      const { specVersion, specName } = await this.getRPCRuntimeVersionCache();
      const metadataRpc = await this.getMetadataRpcCache();
      const network = await this.getNetwork();

      return getRegistry({
        chainName: network.name,
        // @ts-expect-error
        specName: specName.toString(),
        specVersion: specVersion.toNumber(),
        metadataRpc: metadataRpc.toHex(),
      });
    },
    {
      promise: true,
      max: 1,
    },
  );

  // API see https://polkadot.js.org/docs/substrate/runtime
  async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getClientCache(rpcURL);
  }

  async getScanClient() {
    return this.getScanClientCache();
  }

  private async getChainInfo() {
    return this.engine.providerManager.getChainInfoByNetworkId(this.networkId);
  }

  private async getChainInfoImplOptions(): Promise<DotImplOptions> {
    const chainInfo = await this.getChainInfo();
    return chainInfo.implOptions as DotImplOptions;
  }

  override async addressFromBase(accountId: string) {
    const implOptions = await this.getChainInfoImplOptions();
    return accountIdToAddress(
      accountId,
      implOptions.addressPrefix ?? 0,
    ).getValue();
  }

  // Chain only methods

  override createClientFromURL(_url: string): BaseClient {
    // This isn't needed.
    throw new NotImplemented();
  }

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = await this.getNodeClient(url);
    const start = performance.now();
    const version = await client.rpc.chain.getHeader();
    const latestBlock = version.number.toNumber();
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  async _getPublicKey({
    prefix = true,
  }: {
    prefix?: boolean;
  } = {}): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    let publicKey = dbAccount.pub;
    if (prefix) {
      publicKey = addHexPrefix(publicKey);
    }
    return Promise.resolve(publicKey);
  }

  override async validateAddress(address: string) {
    const implOption = await this.getChainInfoImplOptions();
    const result = new RegExp(implOption.addressRegex).test(address);
    if (!result) {
      return Promise.reject(new InvalidAddress());
    }
    return Promise.resolve(address);
  }

  override async validateWatchingCredential(input: string) {
    return this.validateAddress(input)
      .then((address) => this.settings.watchingAccountEnabled && !!address)
      .catch(() => false);
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();

    const requestAddress = groupBy(requests, (request) => request.address);

    // const balances = new Map<string, BigNumber>();
    return Promise.all(
      Object.entries(requestAddress).map(async ([address, tokens]) => {
        try {
          // const balances = await client.query.balances.account(address);
          const {
            // @ts-expect-error
            data: { free: previousFree },
            // @ts-expect-error
            nonce: previousNonce,
          } = await client.query.system.account(address);

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          return new BigNumber(previousFree.toString());
        } catch (error) {
          // ignore account error
          return undefined;
        }
      }),
    );
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxDot> {
    const { to, amount, token: tokenAddress } = transferInfo;
    const { address: from } = await this.getDbAccount();

    let amountValue;
    const client = await this.getClient();

    const { block } = await client.rpc.chain.getBlock();
    const blockHash = await client.rpc.chain.getBlockHash();
    const genesisHash = await client.rpc.chain.getBlockHash(0);
    const metadataRpc = await this.getMetadataRpcCache();
    const { specVersion, transactionVersion } =
      await this.getRPCRuntimeVersionCache();

    const previousNonce = await client.call.accountNonceApi.accountNonce(from);

    const network = await this.getNetwork();

    const registry = await this.getRegistryCache();

    const info = {
      address: from,
      blockHash: blockHash.toHex(),
      blockNumber: registry
        .createType('BlockNumber', block.header.number)
        .toNumber(),
      eraPeriod: 64,
      genesisHash: genesisHash.toHex(),
      metadataRpc: metadataRpc.toHex(),
      nonce: parseInt(previousNonce.toString()),
      specVersion: specVersion.toNumber(),
      tip: 0,
      transactionVersion: transactionVersion.toNumber(),
    };

    const option = {
      metadataRpc: metadataRpc.toHex(),
      registry,
    };

    let unsigned;
    if (tokenAddress && tokenAddress !== '') {
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        tokenAddress,
      );

      if (typeof token === 'undefined') {
        throw new OneKeyInternalError('Failed to get token info.');
      }

      amountValue = new BigNumber(amount).shiftedBy(token.decimals).toFixed();
      if (transferInfo?.keepAlive) {
        unsigned = methods.assets.transferKeepAlive(
          {
            id: parseInt(tokenAddress),
            target: to,
            amount: amountValue,
          },
          info,
          option,
        );
      } else {
        unsigned = methods.assets.transfer(
          {
            id: parseInt(tokenAddress),
            target: to,
            amount: amountValue,
          },
          info,
          option,
        );
      }
    } else {
      amountValue = new BigNumber(amount).shiftedBy(network.decimals).toFixed();
      if (transferInfo?.keepAlive) {
        unsigned = methods.balances.transferKeepAlive(
          {
            value: amountValue,
            dest: to,
          },
          info,
          option,
        );
      } else {
        unsigned = methods.balances.transfer(
          {
            value: amountValue,
            dest: to,
          },
          info,
          option,
        );
      }
    }

    // const decodedUnsigned = decode(unsigned, {
    //   metadataRpc: metadataRpc.toHex(),
    //   registry,
    // });

    // registry.setMetadata(createMetadata(registry, metadataRpc.toHex()));
    // const signingPayload = construct.signingPayload(unsigned, { registry });

    return unsigned;
  }

  override decodedTxToLegacy(
    _decodedTx: IDecodedTx,
  ): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async decodeTx(
    encodedTx: IEncodedTxDot,
    _payload?: any,
  ): Promise<IDecodedTx> {
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    let token: Token | undefined = await this.engine.getNativeTokenInfo(
      this.networkId,
    );

    const decodeUnsignedTx = await this.decodeUnsignedTx(encodedTx);

    let action: IDecodedTxAction | null = null;
    const actionType = getTransactionTypeFromTxInfo(decodeUnsignedTx);

    if (
      actionType === IDecodedTxActionType.NATIVE_TRANSFER ||
      actionType === IDecodedTxActionType.TOKEN_TRANSFER
    ) {
      const isToken = actionType === IDecodedTxActionType.TOKEN_TRANSFER;

      const sender = dbAccount.address;

      let actionKey = 'nativeTransfer';

      let to = '';
      let amount = '';

      if (isToken) {
        const {
          // @ts-expect-error
          dest: { id: toAddress },
          amount: tokenAmount,
        } = decodeUnsignedTx.method.args;

        to = toAddress;
        amount = tokenAmount?.toString() ?? '0';

        actionKey = 'tokenTransfer';
        token = await this.engine.ensureTokenInDB(this.networkId, '');
        if (!token) {
          const [remoteToken] = await this.fetchTokenInfos(['']);
          if (remoteToken) {
            token = {
              id: '1',
              isNative: false,
              networkId: this.networkId,
              tokenIdOnNetwork: '',
              name: remoteToken.name,
              symbol: remoteToken.symbol,
              decimals: remoteToken.decimals,
              logoURI: '',
            };
          }

          if (!token) {
            throw new Error('Invalid token address');
          }
        }
      } else {
        const {
          // @ts-expect-error
          dest: { id: toAddress },
          value: tokenAmount,
        } = decodeUnsignedTx.method.args;

        to = toAddress;
        amount = tokenAmount?.toString() ?? '0';
      }

      const transferAction: IDecodedTxActionTokenTransfer = {
        tokenInfo: token,
        from: sender ?? '',
        to,
        amount: new BigNumber(amount).shiftedBy(-token.decimals).toFixed(),
        amountValue: amount,
        extraInfo: null,
      };

      action = {
        type: actionType,
        [actionKey]: transferAction,
      };
    } else {
      action = {
        type: IDecodedTxActionType.UNKNOWN,
        direction: IDecodedTxDirection.OTHER,
        unknownAction: { extraInfo: {} },
      };
    }

    const result: IDecodedTx = {
      txid: '',
      owner: dbAccount.address,
      signer: dbAccount.address,
      nonce: decodeUnsignedTx.nonce,
      actions: [action],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      feeInfo: {
        price: convertFeeValueToGwei({
          value: '1',
          network,
        }),
        limit: '1',
      },
      extraInfo: null,
      encodedTx,
    };

    return Promise.resolve(result);
  }

  async fetchFeeInfo(
    encodedTx: IEncodedTxDot,
    signOnly?: boolean,
  ): Promise<IFeeInfo> {
    // see https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fpolkadot-rpc-tn.dwellir.com#/runtime

    const network = await this.getNetwork();
    const client = await this.getClient();

    const res = await client.derive.tx.signingInfo(
      encodedTx.address,
      encodedTx.nonce,
      parseInt(encodedTx.era),
    );
    // const FAKE_SIGNATURE = new Uint8Array(256).fill(1);
    // or
    const fakeSignature = u8aConcat(
      new Uint8Array([1]),
      new Uint8Array(64).fill(0x42),
    );

    const signedTransaction = await this.serializeSignedTransaction(
      encodedTx,
      u8aToHex(fakeSignature),
    );
    const signedTransactionU8a = hexToU8a(signedTransaction);

    const queryInfo = await client.call.transactionPaymentApi.queryInfo(
      signedTransactionU8a,
      signedTransactionU8a.length,
    );

    const queryInfoJson = queryInfo.toJSON();

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const weight = queryInfoJson.partialFee.toString();

    const limit = new BigNumber(weight).toFixed(0).toString();

    return {
      disableEditFee: true,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit,
      prices: [
        convertFeeValueToGwei({
          value: '1',
          network,
        }),
      ],
      defaultPresetIndex: '0',
    };
  }

  override async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxDot;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxDot> {
    // No fee for transfer
    return Promise.resolve(params.encodedTx);
  }

  override async updateEncodedTx(
    encodedTx: IEncodedTxDot,
    payload: IEncodedTxUpdatePayloadTransfer,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxDot> {
    // max native token transfer update

    if (options.type === 'transfer') {
      const decodeUnsignedTx = await this.decodeUnsignedTx(encodedTx);
      const type = getTransactionTypeFromTxInfo(decodeUnsignedTx);
      if (type === IDecodedTxActionType.NATIVE_TRANSFER) {
        debugLogger.sendTx.debug('updateEncodedTx', 'send max amount');
        const client = await this.getClient();

        const { block } = await client.rpc.chain.getBlock();
        const blockHash = await client.rpc.chain.getBlockHash();
        const genesisHash = await this.getGenesisHashCache();
        const metadataRpc = await this.getMetadataRpcCache();
        const { specVersion, transactionVersion } =
          await this.getRPCRuntimeVersionCache();

        const previousNonce = await client.call.accountNonceApi.accountNonce(
          decodeUnsignedTx.address,
        );

        const {
          // @ts-expect-error
          dest: { id: toAddress },
        } = decodeUnsignedTx.method.args;

        const registry = await this.getRegistryCache();

        const info = {
          address: decodeUnsignedTx.address,
          blockHash: blockHash.toHex(),
          blockNumber: registry
            .createType('BlockNumber', block.header.number)
            .toNumber(),
          eraPeriod: 64,
          genesisHash: genesisHash.toHex(),
          metadataRpc: metadataRpc.toHex(),
          nonce: parseInt(previousNonce.toString()),
          specVersion: specVersion.toNumber(),
          tip: 0,
          transactionVersion: transactionVersion.toNumber(),
        };

        const option = {
          metadataRpc: metadataRpc.toHex(),
          registry,
        };

        const network = await this.getNetwork();
        const amountValue = new BigNumber(payload.amount)
          .shiftedBy(network.decimals)
          .toFixed();

        if (decodeUnsignedTx.method?.name?.indexOf('KeepAlive') !== -1) {
          return methods.balances.transferKeepAlive(
            {
              value: amountValue,
              dest: toAddress,
            },
            info,
            option,
          );
        }
        // return methods.balances.transfer(
        //   {
        //     value: amountValue,
        //     dest: toAddress,
        //   },
        //   info,
        //   option,
        // );

        return methods.balances.transferAll(
          {
            dest: toAddress,
            keepAlive: false,
          },
          info,
          option,
        );
      }
    }

    return Promise.resolve(encodedTx);
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxDot,
  ): Promise<IUnsignedTxPro> {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    return Promise.resolve({
      inputs: [
        {
          address: stripHexPrefix(dbAccount.address),
          value: new BigNumber(0),
          publicKey: stripHexPrefix(dbAccount.pub),
        },
      ],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    });
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    try {
      const client = await this.getClient();
      const txHash = await client.rpc.author.submitExtrinsic(signedTx.rawTx);

      const txid = txHash.toHex();

      debugLogger.engine.info('broadcastTransaction Done:', {
        txid,
        rawTx: signedTx.rawTx,
      });

      return {
        ...signedTx,
        txid,
      };
    } catch (error: any) {
      // It's already been dealt with in the waitPendingTransaction
      if (error instanceof OneKeyInternalError) {
        throw error;
      }

      const { message }: { message: string } = error || {};
      if (
        message.indexOf('Invalid Transaction: Inability to pay some fees') !==
        -1
      ) {
        throw new OneKeyInternalError(
          message,
          'msg__broadcast_dot_tx_Insufficient_fee',
        );
      }

      if (
        message.indexOf('Invalid Transaction: Transaction is outdated') !== -1
      ) {
        throw new OneKeyInternalError(
          message,
          'msg__broadcast_dot_tx_outdated',
        );
      }

      throw new OneKeyInternalError(message);
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

    const scanClient = await this.getScanClient();
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);

    const explorerTxs = await scanClient.getTransactions(
      this.networkId,
      dbAccount.address,
    );

    const promises = explorerTxs.map(async (tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === tx.extrinsic_hash,
      );

      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        // No need to update.
        return Promise.resolve(null);
      }

      try {
        const from = tx.account_id;

        const actionType = getTransactionType(
          tx.call_module,
          tx.call_module_function,
        );

        let action: IDecodedTxAction = {
          type: IDecodedTxActionType.UNKNOWN,
        };

        if (
          actionType === IDecodedTxActionType.NATIVE_TRANSFER ||
          actionType === IDecodedTxActionType.TOKEN_TRANSFER
        ) {
          const params = JSON.parse(tx.params) as ExtrinsicParam[];

          let to = '';
          let amountValue = '0';
          let coinType = '0';

          if (
            tx.call_module_function === 'transfer' ||
            tx.call_module_function === 'transfer_keep_alive'
          ) {
            const [toParam, amountParam] = params;

            to = await this.addressFromBase(get(toParam, 'value.Id', ''));
            amountValue = amountParam.value.toString();
          }

          if (tx.call_module_function === 'transfer_all') {
            const [toParam] = params;

            to = await this.addressFromBase(get(toParam, 'value.Id', ''));
            amountValue = '0';
          }

          if (actionType === IDecodedTxActionType.TOKEN_TRANSFER) {
            const [idParam, targetParam, amountParam] = params;

            coinType = idParam.value.toString();
            to = await this.addressFromBase(get(targetParam, 'value.Id', ''));
            amountValue = amountParam.value.toString();
          }

          const isToken = actionType === IDecodedTxActionType.TOKEN_TRANSFER;

          let direction = IDecodedTxDirection.IN;
          if (from === dbAccount.address) {
            direction =
              to === dbAccount.address
                ? IDecodedTxDirection.SELF
                : IDecodedTxDirection.OUT;
          }

          let token: Token | undefined = await this.engine.getNativeTokenInfo(
            this.networkId,
          );
          let actionKey = 'nativeTransfer';
          if (isToken) {
            actionKey = 'tokenTransfer';
            token = await this.engine.ensureTokenInDB(this.networkId, coinType);
            if (typeof token === 'undefined') {
              throw new OneKeyInternalError('Failed to get token info.');
            }
          }

          action = {
            type: actionType,
            direction,
            [actionKey]: {
              tokenInfo: token,
              from,
              to,
              amount: new BigNumber(amountValue)
                .shiftedBy(-token.decimals)
                .toFixed(),
              amountValue,
              extraInfo: null,
            },
          };
        }

        const feeValue = tx.fee_used;

        const { success } = tx;
        let status = IDecodedTxStatus.Pending;
        if (success === false) {
          status = IDecodedTxStatus.Failed;
        } else if (success === true) {
          status = IDecodedTxStatus.Confirmed;
        }

        const decodedTx: IDecodedTx = {
          txid: tx.extrinsic_hash,
          owner: dbAccount.address,
          signer: from,
          nonce: tx.nonce,
          actions: [action],
          status,
          networkId: this.networkId,
          accountId: this.accountId,
          encodedTx: undefined,
          extraInfo: null,
          totalFeeInNative: new BigNumber(feeValue)
            .shiftedBy(-decimals)
            .toFixed(),
        };
        decodedTx.updatedAt = tx.block_timestamp;
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
    const scanClient = await this.getScanClient();

    return Promise.all(
      txids.map(async (txid) => {
        try {
          const tx = await scanClient.getTransaction(this.networkId, txid);

          let status = TransactionStatus.PENDING;
          if (tx.success === false) {
            status = TransactionStatus.CONFIRM_BUT_FAILED;
          } else if (tx.finalized) {
            status = TransactionStatus.CONFIRM_AND_SUCCESS;
          }
          return await Promise.resolve(status);
        } catch (error: any) {
          const { message } = error;

          if (message === '404' || message === '400') {
            return Promise.resolve(TransactionStatus.NOT_FOUND);
          }
        }
      }),
    );
  }

  // ======== Keyring Utils ========

  // see https://github.com/paritytech/txwrapper-core/blob/main/packages/txwrapper-examples/polkadot/src/polkadot.ts
  async decodeUnsignedTx(unsigned: IEncodedTxDot) {
    const registry = await this.getRegistryCache();

    const { metadataRpc } = unsigned;
    const decodedUnsigned = decode(unsigned, {
      metadataRpc,
      registry,
    });

    return decodedUnsigned;
  }

  async serializeUnsignedTransaction(encodedTx: IEncodedTxDot): Promise<{
    rawTx: Uint8Array;
    hash: Uint8Array;
  }> {
    const unsigned = encodedTx;
    const { metadataRpc } = unsigned;

    const registry = await this.getRegistryCache();

    registry.setMetadata(createMetadata(registry, metadataRpc));
    const signingPayload = construct.signingPayload(unsigned, { registry });

    const extrinsicPayload = registry.createType(
      'ExtrinsicPayload',
      signingPayload,
      {
        version: EXTRINSIC_VERSION,
      },
    );

    const u8a = extrinsicPayload.toU8a({
      method: true,
    });
    const encoded = u8a.length > 256 ? registry.hash(u8a) : u8a;

    return {
      rawTx: u8a,
      hash: u8aToU8a(encoded),
    };
  }

  async serializeMessage(message: string): Promise<Buffer> {
    const encoded = u8aWrapBytes(message);
    return Buffer.from(u8aToU8a(encoded));
  }

  async serializeSignedTransaction(
    encodedTx: IEncodedTxDot,
    signature: string,
  ) {
    const { metadataRpc } = encodedTx;

    const registry = await this.getRegistryCache();

    const tx = construct.signedTx(
      encodedTx,
      addHexPrefix(signature) as unknown as `0x${string}`,
      {
        metadataRpc,
        registry,
      },
    );

    return tx;
  }

  async encodeUnsignedTransaction(encodedTx: IEncodedTxDot) {
    const registry = await this.getRegistryCache();

    const tx = construct.encodeUnsignedTransaction(encodedTx, {
      registry,
    });

    return tx;
  }

  override async getMinDepositAmount(): Promise<BigNumber.Value> {
    const key = `${this.networkId}-existentialDeposit`;
    if (this.cache[key]) {
      return this.cache[key] as string;
    }

    const client = await this.getClient();
    const codec = client.consts.balances.existentialDeposit;

    const existentialDeposit = codec.toString();

    if (new BigNumber(existentialDeposit).isGreaterThanOrEqualTo('0')) {
      this.cache[key] = existentialDeposit;
    }

    return existentialDeposit;
  }
}
