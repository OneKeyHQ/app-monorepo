/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { bytesToHex } from '@noble/hashes/utils';
import {
  construct,
  createMetadata,
  decode,
  getRegistry,
  methods,
} from '@substrate/txwrapper-polkadot';
import BigNumber from 'bignumber.js';
import { groupBy, isEmpty, isNil } from 'lodash';

import type { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import {
  InvalidAddress,
  InvalidTransferValue,
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/engine/src/errors';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type {
  DBAccount,
  DBVariantAccount,
} from '@onekeyhq/engine/src/types/account';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
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
import {
  convertFeeGweiToValue,
  convertFeeValueToGwei,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';
import {
  addHexPrefix,
  stripHexPrefix,
} from '@onekeyhq/engine/src/vaults/utils/hexUtils';
import { VaultBase } from '@onekeyhq/engine/src/vaults/VaultBase';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { formatBalanceDisplay } from '@onekeyhq/kit/src/components/Format';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import polkadotSdk from './sdk/polkadotSdk';
import { EXTRINSIC_VERSION } from './sdk/polkadotSdkTypes';
import settings from './settings';
import { SubScanClient } from './substrate/query/subscan';
import { getTransactionTypeFromTxInfo, getTransactionTypeV2 } from './utils';

import type {
  BlockHash,
  IApiPromise,
  Metadata,
  ProviderInterface,
  RuntimeVersion,
} from './sdk/polkadotSdkTypes';
import type { DotImplOptions, IEncodedTxDot } from './types';
import type {
  Args,
  BaseTxInfo,
  TypeRegistry,
} from '@substrate/txwrapper-polkadot';

const {
  encodeAddress,
  decodeAddress,
  ApiPromise,
  HttpProvider,
  WsProvider,
  hexToNumber,
  hexToU8a,
  u8aConcat,
  u8aToHex,
  u8aToU8a,
  u8aWrapBytes,
} = polkadotSdk;

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

  getScanClientCache = memoizee(async () => new SubScanClient(), {
    promise: true,
    max: 1,
  });

  // ======== Chain Vault Methods ========
  getRPCRuntimeVersionCache = memoizee(
    async (): Promise<RuntimeVersion> => {
      const client = await this.getApiClient();
      return client.rpc.state.getRuntimeVersion();
    },
    {
      promise: true,
      primitive: true,
      max: 1,
      normalizer: () => `${this.networkId}`,
    },
  );

  getGenesisHashCache = memoizee(
    async (): Promise<BlockHash> => {
      const client = await this.getApiClient();
      return client.rpc.chain.getBlockHash(0);
    },
    {
      promise: true,
      primitive: true,
      max: 1,
      normalizer: () => `${this.networkId}`,
    },
  );

  getMetadataRpcCache = memoizee(
    async (): Promise<Metadata> => {
      const client = await this.getApiClient();
      return client.rpc.state.getMetadata();
    },
    {
      promise: true,
      primitive: true,
      max: 1,
      normalizer: () => `${this.networkId}`,
    },
  );

  getRegistryCache = memoizee(
    async (params: {
      metadataRpc?: `0x${string}`;
      specVersion?: string;
      specName?: string;
    }): Promise<TypeRegistry> => {
      const network = await this.getNetwork();

      let metadataRpcHex: `0x${string}`;
      if (isNil(params.metadataRpc) || isEmpty(params.metadataRpc)) {
        metadataRpcHex = (await this.getMetadataRpcCache()).toHex();
      } else {
        metadataRpcHex = params.metadataRpc;
      }

      let specVersion: number;
      let specName: string;
      if (
        !params.specVersion ||
        isEmpty(params.specVersion) ||
        !params.specName ||
        isEmpty(params.specName)
      ) {
        const runtime = await this.getRPCRuntimeVersionCache();
        specVersion = runtime.specVersion.toNumber();
        specName = runtime.specName.toString();
      } else {
        specVersion = hexToNumber(addHexPrefix(params.specVersion));
        specName = params.specName;
      }

      return getRegistry({
        chainName: network.name,
        // @ts-expect-error
        specName,
        specVersion,
        metadataRpc: metadataRpcHex,
      });
    },
    {
      promise: true,
      max: 1,
      normalizer: () => `${this.networkId}`,
    },
  );

  getMinDepositAmountCache = memoizee(
    async (): Promise<BigNumber.Value> => {
      const client = await this.getApiClient();
      const codec = client.consts.balances.existentialDeposit;

      const existentialDeposit = codec.toString();
      return existentialDeposit;
    },
    {
      promise: true,
      primitive: true,
      max: 1,
      normalizer: () => `${this.networkId}`,
    },
  );

  // ======== END Chain Vault Methods ========

  getNodeProvider = (rpcUrl: string) => {
    const uri = new URL(rpcUrl);
    let provider;
    if (uri.protocol === 'wss:') {
      provider = new WsProvider(rpcUrl);
    } else {
      provider = new HttpProvider(rpcUrl);
    }
    return provider;
  };

  getNodeClient = async (rpcUrl: string) => {
    const provider = this.getNodeProviderCache(rpcUrl);
    return ApiPromise.create({ provider, initWasm: false });
  };

  getNodeProviderCache = memoizee(
    (rpcUrl: string): ProviderInterface => this.getNodeProvider(rpcUrl),
    {
      primitive: true,
      max: 1,
      normalizer: ([rpcUrl]) => rpcUrl,
      dispose: async (value: ProviderInterface) => {
        await value.disconnect();
      },
    },
  );

  getClientCache = memoizee(
    async (rpcUrl: string): Promise<IApiPromise> => this.getNodeClient(rpcUrl),
    {
      promise: true,
      primitive: true,
      max: 1,
      normalizer: ([rpcUrl]) => rpcUrl,
      dispose: async (value: IApiPromise) => {
        await value.disconnect();
      },
    },
  );

  async getApiClient(): Promise<IApiPromise> {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getClientCache(rpcURL);
  }

  // API see https://polkadot.js.org/docs/substrate/runtime
  async getClient() {
    const vault = await this.getChainVault();
    return vault.getApiClient();
  }

  async getChainVault(): Promise<Vault> {
    return this.engine.getChainOnlyVault(this.networkId) as Promise<Vault>;
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

  async addressFromAccountId(accountId: string) {
    if (isNil(accountId) || isEmpty(accountId)) {
      return '';
    }

    const implOptions = await this.getChainInfoImplOptions();
    return encodeAddress(
      addHexPrefix(accountId),
      implOptions?.addressPrefix ?? 0,
    );
  }

  override async addressFromBase(account: DBAccount) {
    const variantAccount = account as DBVariantAccount;

    const existAddress = variantAccount.addresses[this.networkId]?.trim();
    if (isNil(existAddress) || isEmpty(existAddress)) {
      return this.addressFromAccountId(variantAccount.pub);
    }

    return variantAccount.addresses[this.networkId];
  }

  // Chain only methods
  override createClientFromURL(_url: string): BaseClient {
    // This isn't needed.
    throw new NotImplemented();
  }

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const uri = new URL(url);

    if (uri.protocol === 'wss:') {
      const ws = new WebSocket(url);
      return new Promise((resolve, reject) => {
        ws.onopen = () => {
          const start = performance.now();
          ws.send(
            '{"id":1,"jsonrpc":"2.0","method":"chain_getHeader","params":[]}',
          );

          ws.onmessage = (event) => {
            const data: {
              id: number;
              result: {
                number: string;
              };
            } = JSON.parse(event.data);

            if (data.id !== 1) {
              if (ws.OPEN) ws.close();
              return;
            }

            const responseTime = Math.floor(performance.now() - start);

            if (ws.OPEN) ws.close();
            resolve({
              responseTime,
              latestBlock: hexToNumber(data.result.number),
            });
          };

          ws.onerror = (event) => {
            if (ws.OPEN) ws.close();
            reject(event);
          };
        };
      });
    }

    const provider = this.getNodeProvider(url);
    const start = performance.now();
    const header: { number: string } = await provider.send(
      'chain_getHeader',
      [],
    );
    const responseTime = Math.floor(performance.now() - start);

    return {
      responseTime,
      latestBlock: hexToNumber(header.number),
    };
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
            // @ts-ignore
            data: { free: previousFree },
            // nonce: previousNonce,
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

  async getAddressByTxArgs(args: Args): Promise<string> {
    const chainId = await this.getNetworkChainId();
    let {
      // @ts-expect-error
      dest: { id: address },
    } = args;
    if (chainId === 'joystream') {
      address = args.dest;
    }

    return Promise.resolve(address as string);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxDot> {
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const implOptions = await this.getChainInfoImplOptions();

    const { to, amount, token: tokenAddress } = transferInfo;
    const { address: from } = await this.getDbAccount();
    const toAccountId = decodeAddress(
      to,
      true,
      implOptions?.addressPrefix ?? 0,
    );

    const chainId = await this.getNetworkChainId();
    let toAccount = { id: to };
    // pending txwapper-polkadot support JoyStream
    if (chainId === 'joystream') {
      // @ts-expect-error
      toAccount = `0x${bytesToHex(toAccountId)}`;
    }

    let amountValue;
    const client = await this.getClient();

    const { block } = await client.rpc.chain.getBlock();
    const blockHash = await client.rpc.chain.getBlockHash();
    const chainVault = await this.getChainVault();
    const genesisHash = await chainVault.getGenesisHashCache();
    const metadataRpc = await chainVault.getMetadataRpcCache();
    const { specVersion, specName, transactionVersion } =
      await chainVault.getRPCRuntimeVersionCache();

    const previousNonce = await client.call.accountNonceApi.accountNonce(from);

    const network = await this.getNetwork();

    const registry = await chainVault.getRegistryCache({
      metadataRpc: metadataRpc.toHex(),
      specVersion: specVersion.toHex(),
      specName: specName.toString(),
    });

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
            dest: toAccount,
          },
          info,
          option,
        );
      } else if (chainId === 'joystream') {
        unsigned = methods.balances.transfer(
          {
            value: amountValue,
            dest: toAccount,
          },
          info,
          option,
        );
      } else {
        unsigned = methods.balances.transferAllowDeath(
          {
            value: amountValue,
            dest: toAccount,
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

    return {
      ...unsigned,
      specName: specName.toString(),
    };
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
        const { amount: tokenAmount } = decodeUnsignedTx.method.args;
        to = await this.getAddressByTxArgs(decodeUnsignedTx.method.args);

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
        const { value: tokenAmount } = decodeUnsignedTx.method.args;
        to = await this.getAddressByTxArgs(decodeUnsignedTx.method.args);
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
      // Transaction sending completes parsing the real feeInfo
      feeInfo: encodedTx?.feeInfo ?? {
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

    let limit = '0';
    try {
      const queryInfo = await client.call.transactionPaymentApi.queryInfo(
        signedTransactionU8a,
        signedTransactionU8a.length,
      );

      const queryInfoJson = queryInfo.toJSON();

      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const weight = queryInfoJson.partialFee.toString();
      limit = new BigNumber(weight).toFixed(0).toString();
    } catch (error) {
      const queryInfo =
        await client.call.transactionPaymentCallApi.queryCallFeeDetails(
          signedTransactionU8a,
          signedTransactionU8a.length,
        );
      const queryInfoJson = queryInfo.toJSON();

      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      limit = new BigNumber(queryInfoJson.inclusionFee.baseFee.toString())
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        .plus(queryInfoJson.inclusionFee.lenFee.toString())
        .toFixed(0)
        .toString();
    }

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
    const { price, limit } = params.feeInfoValue;

    if (!price || typeof price !== 'string') {
      throw new OneKeyInternalError('Invalid gas price.');
    }
    if (typeof limit !== 'string') {
      throw new OneKeyInternalError('Invalid fee limit');
    }

    const network = await this.getNetwork();

    const priceValue = convertFeeGweiToValue({
      value: price,
      network,
    });

    return Promise.resolve({
      ...params.encodedTx,
      // Temporarily store the fee info
      feeInfo: {
        price,
        limit,
      },
    });
  }

  override async specialCheckEncodedTx(
    encodedTx: IEncodedTxDot,
  ): Promise<{ success: boolean; key?: string; params?: object | undefined }> {
    const [balance] = await this.getAccountBalance([]);

    const decodeUnsignedTx = await this.decodeUnsignedTx(encodedTx);

    const actionType = getTransactionTypeFromTxInfo(decodeUnsignedTx);

    if (actionType === IDecodedTxActionType.NATIVE_TRANSFER) {
      const { value: tokenAmount } = decodeUnsignedTx.method.args;
      const toAddress = await this.getAddressByTxArgs(
        decodeUnsignedTx.method.args,
      );
      if (toAddress === encodedTx.address)
        return Promise.resolve({ success: true });

      // Read in the cache minDepositAmount，Do not use directly this.getMinDepositAmount
      const minDepositAmount =
        await backgroundApiProxy.serviceToken.getMinDepositAmount({
          networkId: this.networkId,
          accountId: this.accountId,
        });

      const network = await this.getNetwork();

      const depositAmountDisplay = formatBalanceDisplay(
        minDepositAmount,
        null,
        {
          unit: network.decimals,
        },
      );

      const priceValue = convertFeeGweiToValue({
        value: encodedTx?.feeInfo?.price?.toString() ?? '0',
        network,
      });

      const txPrice = new BigNumber(
        parseFloat(priceValue) * parseFloat(encodedTx?.feeInfo?.limit ?? '0'),
      ).toFixed(0);

      if (
        balance
          ?.minus(tokenAmount?.toString() ?? '0')
          ?.minus(txPrice)
          .lt(minDepositAmount)
      ) {
        return Promise.resolve({
          success: false,
          key: 'msg__error_dot_account_retention_prompt',
          params: {
            0: `${depositAmountDisplay.amount ?? '0'} ${network.symbol}`,
          },
        });
      }
    }

    return Promise.resolve({ success: true });
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

        const chainId = await this.getNetworkChainId();
        let {
          // @ts-expect-error
          dest: { id: toAddress },
        } = decodeUnsignedTx.method.args;
        if (chainId === 'joystream') {
          toAddress = decodeUnsignedTx.method.args.dest;
        }

        const chainVault = await this.getChainVault();
        const registry = await chainVault.getRegistryCache(encodedTx);

        const info: BaseTxInfo = {
          address: decodeUnsignedTx.address,
          blockHash: encodedTx.blockHash,
          blockNumber: hexToNumber(addHexPrefix(encodedTx.blockNumber)),
          eraPeriod: 64,
          genesisHash: encodedTx.genesisHash,
          metadataRpc: encodedTx.metadataRpc,
          nonce: hexToNumber(addHexPrefix(encodedTx.nonce)),
          specVersion: hexToNumber(addHexPrefix(encodedTx.specVersion)),
          tip: 0,
          transactionVersion: hexToNumber(
            addHexPrefix(encodedTx.transactionVersion),
          ),
        };

        const option = {
          metadataRpc: encodedTx.metadataRpc,
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

    const explorerTxs = await scanClient.getTransactionsV2(
      this.networkId,
      dbAccount.address,
    );

    const promises = explorerTxs.map(async (tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === tx.hash,
      );

      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        // No need to update.
        return Promise.resolve(null);
      }

      try {
        const { from, to, module, amount_v2: amountValue, fee: feeValue } = tx;

        const actionType = getTransactionTypeV2(module);

        let action: IDecodedTxAction = {
          type: IDecodedTxActionType.UNKNOWN,
        };

        const token: Token | undefined = await this.engine.getNativeTokenInfo(
          this.networkId,
        );

        if (
          actionType === IDecodedTxActionType.NATIVE_TRANSFER ||
          actionType === IDecodedTxActionType.TOKEN_TRANSFER
        ) {
          // const isToken = actionType === IDecodedTxActionType.TOKEN_TRANSFER;

          let direction = IDecodedTxDirection.IN;
          if (from === dbAccount.address) {
            direction =
              to === dbAccount.address
                ? IDecodedTxDirection.SELF
                : IDecodedTxDirection.OUT;
          }

          // let token: Token | undefined = await this.engine.getNativeTokenInfo(
          //   this.networkId,
          // );
          const actionKey = 'nativeTransfer';
          // if (isToken) {
          //   actionKey = 'tokenTransfer';
          //   token = await this.engine.ensureTokenInDB(this.networkId, coinType);
          //   if (typeof token === 'undefined') {
          //     throw new OneKeyInternalError('Failed to get token info.');
          //   }
          // }

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

        const { success } = tx;
        let status = IDecodedTxStatus.Pending;
        if (success === false) {
          status = IDecodedTxStatus.Failed;
        } else if (success === true) {
          status = IDecodedTxStatus.Confirmed;
        }

        const decodedTx: IDecodedTx = {
          txid: tx.hash,
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
        decodedTx.updatedAt = tx.block_timestamp * 1000;
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

  override async validateSendAmount(
    amount: string,
    tokenBalance: string,
    to: string,
  ): Promise<boolean> {
    try {
      if (isNil(amount) || isEmpty(amount)) {
        return true;
      }
      const network = await this.getNetwork();

      const depositAmountOnChain =
        await backgroundApiProxy.serviceToken.getMinDepositAmount({
          networkId: this.networkId,
          accountId: this.accountId,
        });
      const depositAmount = new BigNumber(depositAmountOnChain);
      const sendAmount = new BigNumber(amount).shiftedBy(network.decimals);

      const [accountBalance] = await this.getBalances([{ address: to }]);

      const depositAmountDisplay = formatBalanceDisplay(depositAmount, null, {
        unit: network.decimals,
      });

      if (!depositAmountDisplay.amount) return false;

      if (accountBalance?.plus(sendAmount).lt(depositAmount)) {
        throw new InvalidTransferValue('form__amount_recipient_activate', {
          amount: depositAmountDisplay.amount,
          unit: network.symbol,
        });
      }
      return true;
    } catch (err: any) {
      console.log(err);
      throw err;
    }
  }

  override async getMinDepositAmount(): Promise<BigNumber.Value> {
    return (await this.getChainVault()).getMinDepositAmountCache();
  }

  override async destroy() {
    await this.getMetadataRpcCache.clear();
    this.getNodeProviderCache.clear();
  }

  // ======== Keyring Utils ========

  // see https://github.com/paritytech/txwrapper-core/blob/main/packages/txwrapper-examples/polkadot/src/polkadot.ts
  async decodeUnsignedTx(unsigned: IEncodedTxDot) {
    const chainVault = await this.getChainVault();
    const registry = await chainVault.getRegistryCache(unsigned);

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

    const chainVault = await this.getChainVault();
    const registry = await chainVault.getRegistryCache(unsigned);

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
    const chainVault = await this.getChainVault();
    const registry = await chainVault.getRegistryCache(encodedTx);

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
    const chainVault = await this.getChainVault();
    const registry = await chainVault.getRegistryCache(encodedTx);

    const tx = construct.encodeUnsignedTransaction(encodedTx, {
      registry,
    });

    return tx;
  }
}
