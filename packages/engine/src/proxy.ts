/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint max-classes-per-file: "off" */

import { Buffer } from 'buffer';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import BigNumber from 'bignumber.js';

import { ProviderController as BaseProviderController } from '@onekeyhq/blockchain-libs/src/provider';
import { Geth } from '@onekeyhq/blockchain-libs/src/provider/chains/eth/geth';
import type {
  BaseClient,
  BaseProvider,
  ClientFilter,
} from '@onekeyhq/engine/src/client/BaseClient';
import {
  N,
  sign,
  uncompressPublicKey,
  verify,
} from '@onekeyhq/engine/src/secret';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type { ChainInfo } from '@onekeyhq/engine/src/types/chain';
import type { UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import type {
  Signer as ISigner,
  Verifier as IVerifier,
} from '@onekeyhq/engine/src/types/secret';
import {
  IMPL_ALGO,
  IMPL_BCH,
  IMPL_BTC,
  IMPL_DOGE,
  IMPL_LTC,
  IMPL_NEURAI,
  IMPL_TBTC,
  SEPERATOR,
} from '@onekeyhq/shared/src/engine/engineConsts';
import bufferUitls from '@onekeyhq/shared/src/utils/bufferUtils';

import { OneKeyInternalError } from './errors';
import { getBlockNativeGasInfo } from './managers/blockNative';
import { getCurveByImpl } from './managers/impl';
import { getMetaMaskGasInfo } from './managers/metaMask';
import { getPresetNetworks } from './presets';
import { IMPL_MAPPINGS, fillUnsignedTx, fillUnsignedTxObj } from './proxyUtils';
import { getRpcUrlFromChainInfo } from './vaults/utils/btcForkChain/provider/blockbook';

import type { BlockNativeGasInfo } from './types/blockNative';
import type { MetaMaskGasInfo } from './types/metaMask';
import type { DBNetwork, EIP1559Fee } from './types/network';

type Curve = 'secp256k1' | 'ed25519';

function fromDBNetworkToChainInfo(dbNetwork: DBNetwork): ChainInfo {
  const defaultClient = IMPL_MAPPINGS[dbNetwork.impl]?.defaultClient;

  let providerOptions: Record<string, any> = {};
  let { rpcURL } = dbNetwork;
  let algoIndexerURL = '';

  const presetNetwork = getPresetNetworks()[dbNetwork.id];
  if (typeof presetNetwork !== 'undefined') {
    ({ providerOptions } = presetNetwork.extensions || { providerOptions: {} });
    rpcURL = rpcURL || presetNetwork.presetRpcURLs[0];
    if (presetNetwork.impl === IMPL_ALGO) {
      const urlGroup = (presetNetwork.rpcURLs || [])[0];
      algoIndexerURL = (urlGroup || {}).indexer ?? '';
    }
  }

  let implOptions = providerOptions || {};

  const chainId = parseInt(dbNetwork.id.split(SEPERATOR)[1]);
  implOptions = { ...implOptions, chainId };

  let code = dbNetwork.id;
  if (
    [IMPL_BTC, IMPL_DOGE, IMPL_LTC, IMPL_BCH, IMPL_TBTC, IMPL_NEURAI].includes(
      dbNetwork.impl,
    )
  ) {
    code = dbNetwork.impl;
  }

  return {
    code,
    feeCode: dbNetwork.id,
    impl: dbNetwork.impl,
    curve: (dbNetwork.curve || getCurveByImpl(dbNetwork.impl)) as Curve,
    implOptions,
    clients: [
      {
        name: defaultClient,
        args:
          dbNetwork.impl === IMPL_ALGO
            ? [rpcURL, { url: algoIndexerURL }]
            : [rpcURL],
      },
    ],
  };
}

export { fillUnsignedTxObj, fillUnsignedTx };

export interface IVerifierPro extends IVerifier {
  verifySignature(params: {
    publicKey: Buffer | Uint8Array | string; // hex string or Buffer
    digest: Buffer | Uint8Array | string; // hex string or Buffer
    signature: Buffer | Uint8Array | string; // hex string or Buffer
  }): Promise<boolean>;
}

export class Verifier implements IVerifierPro {
  private uncompressedPublicKey: Buffer;

  private compressedPublicKey: Buffer;

  curve: Curve;

  constructor(pub: string, curve: Curve) {
    this.curve = curve;
    this.compressedPublicKey = Buffer.from(pub, 'hex');
    this.uncompressedPublicKey = uncompressPublicKey(
      curve,
      this.compressedPublicKey,
    );
  }

  getPubkey(compressed?: boolean) {
    return Promise.resolve(
      compressed ? this.compressedPublicKey : this.uncompressedPublicKey,
    );
  }

  verify(_digest: Buffer, _signature: Buffer) {
    // Not used.
    return Promise.resolve(Buffer.from([]));
  }

  verifySignature({
    publicKey,
    digest,
    signature,
  }: {
    publicKey: Buffer | Uint8Array | string; // hex string or Buffer
    digest: Buffer | Uint8Array | string; // hex string or Buffer
    signature: Buffer | Uint8Array | string; // hex string or Buffer
  }): Promise<boolean> {
    const p = bufferUitls.toBuffer(publicKey);
    const d = bufferUitls.toBuffer(digest);
    const s = bufferUitls.toBuffer(signature);
    const { curve } = this;
    const result = verify(curve, p, d, s);
    return Promise.resolve(result);
  }
}

// @ts-ignore
export class Signer extends Verifier implements ISigner {
  constructor(
    private encryptedPrivateKey: Buffer,
    private password: string,
    private override curve: Curve,
  ) {
    super(
      N(
        curve,
        { key: encryptedPrivateKey, chainCode: Buffer.alloc(32) },
        password,
      ).key.toString('hex'),
      curve,
    );
  }

  getPrvkey(): Promise<Buffer> {
    return Promise.resolve(decrypt(this.password, this.encryptedPrivateKey));
  }

  sign(digest: Buffer): Promise<[Buffer, number]> {
    const signature = sign(
      this.curve,
      this.encryptedPrivateKey,
      digest,
      this.password,
    );
    if (this.curve === 'secp256k1') {
      return Promise.resolve([
        signature.slice(0, -1),
        signature[signature.length - 1],
      ]);
    }
    return Promise.resolve([signature, 0]);
  }
}

// blockchain-libs can throw ResponseError and JSONResponseError upon rpc call
// errors/failures. Each error has both message & response properties.
// We read the possible error, categorize it by its message and decide
// what to throw to upper layer.
function extractResponseError(e: unknown): unknown {
  const { message, response } = e as { message?: string; response?: any };
  if (typeof message === 'undefined' || typeof response === 'undefined') {
    // not what we expected, throw original error out.
    return e;
  }
  if (message === 'Error JSON PRC response') {
    // TODO: avoid this stupid string comparison and there is even an unbearable typo.
    // this is what blockchain-libs can throw upon a JSON RPC call failure
    const { error: rpcError } = response;
    if (typeof rpcError !== 'undefined') {
      return web3Errors.rpc.internal({ data: rpcError });
    }
  }
  // Otherwise, throw the original error out.
  // TODO: see whether to wrap it into a gerinic OneKeyError.
  return e;
}

class ProviderController extends BaseProviderController {
  private clients: Record<string, BaseClient> = {};

  private providers: Record<string, BaseProvider> = {};

  constructor(
    public getChainInfoByNetworkId: (networkId: string) => Promise<ChainInfo>,
  ) {
    super((_chainCode) => ({
      code: '',
      feeCode: '',
      impl: '',
      implOptions: {},
      curve: 'secp256k1',
      clients: [],
    }));
  }

  public getVerifier(networkId: string, pub: string): IVerifier {
    const provider = this.providers[networkId];
    if (typeof provider === 'undefined') {
      throw new OneKeyInternalError('Provider not found.');
    }

    const { curve } = this.providers[networkId].chainInfo;
    return new Verifier(pub, curve as Curve);
  }
  // TODO: set client api to support change.

  // TODO legacy getRpcClient
  override async getClient(
    networkId: string,
    filter?: ClientFilter,
  ): Promise<BaseClient> {
    const filterClient = filter || (() => true);
    const chainInfo = await this.getChainInfoByNetworkId(networkId);

    if (
      !this.clients[networkId] ||
      getRpcUrlFromChainInfo(this.clients[networkId].chainInfo) !==
        getRpcUrlFromChainInfo(chainInfo)
    ) {
      const module = this.requireChainImpl(chainInfo.impl);
      const { name, args } = chainInfo.clients[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const ClientClass = module[name] || module.Client;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      this.clients[networkId] = new ClientClass(...args);
      this.clients[networkId].setChainInfo(chainInfo);
    }

    const client = this.clients[networkId];

    if (typeof client !== 'undefined' && filterClient(client)) {
      return Promise.resolve(client);
    }
    return Promise.reject(new OneKeyInternalError('Unable to init client.'));
  }

  override async getProvider(networkId: string): Promise<BaseProvider> {
    const chainInfo = await this.getChainInfoByNetworkId(networkId);

    if (
      !this.providers[networkId] ||
      getRpcUrlFromChainInfo(this.providers[networkId].chainInfo) !==
        getRpcUrlFromChainInfo(chainInfo)
    ) {
      const { Provider } = this.requireChainImpl(chainInfo.impl);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this.providers[networkId] = new Provider(
        chainInfo,
        (filter?: ClientFilter) => this.getClient(networkId, filter),
      );
    }

    const provider = this.providers[networkId];
    if (typeof provider !== 'undefined') {
      return Promise.resolve(provider);
    }
    return Promise.reject(new OneKeyInternalError('Unable to init provider.'));
  }

  override requireChainImpl(impl: string): any {
    return super.requireChainImpl(IMPL_MAPPINGS[impl]?.implName || impl);
  }

  async getEVMChainId(url: string): Promise<string> {
    const client = new Geth(url);
    return parseInt(await client.rpc.call('eth_chainId', []), 16).toString();
  }

  addressFromXpub(networkId: string, xpub: Buffer): Promise<string> {
    return this.addressFromPub(networkId, xpub.slice(-33).toString('hex'));
  }

  async addressFromPub(networkId: string, pub: string): Promise<string> {
    await this.getProvider(networkId);
    return this.pubkeyToAddress(
      networkId,
      this.getVerifier(networkId, pub),
      undefined,
    );
  }

  async getGasInfo(networkId: string): Promise<
    | {
        prices: Array<BigNumber | EIP1559Fee>;
        networkCongestion?: number;
        estimatedTransactionCount?: number;
      }
    | undefined
  > {
    // TODO: move this into libs.
    const { EIP1559Enabled } =
      (await this.getProvider(networkId)).chainInfo.implOptions || {};
    if (EIP1559Enabled || false) {
      try {
        const gasInfo = await this.getGasInfoFromApi(networkId);
        return {
          ...gasInfo,
          prices: gasInfo.prices as EIP1559Fee[],
        };
      } catch {
        const result = await this.getClient(networkId).then((client) =>
          (client as Geth).rpc.batchCall<[string, { baseFeePerGas: string }]>([
            ['eth_maxPriorityFeePerGas', []],
            ['eth_getBlockByNumber', ['pending', true]],
          ]),
        );
        // doc https://docs.alchemy.com/docs/maxpriorityfeepergas-vs-maxfeepergas#example-using-maxfeepergas-a-hreflets-see-them-in-action-idlets-see-them-in-actiona
        if (result) {
          const coefficients: string[] = ['1.13', '1.25', '1.3'];
          const [maxPriorityFeePerGas, { baseFeePerGas }] = result;
          const baseFee = new BigNumber(baseFeePerGas).shiftedBy(-9);
          const maxPriorityFee = new BigNumber(maxPriorityFeePerGas).shiftedBy(
            -9,
          );

          return {
            prices: coefficients.map((coefficient) => {
              const maxPriorityFeePerGasBN = maxPriorityFee.times(coefficient);
              return {
                baseFee: baseFee.toFixed(),
                maxPriorityFeePerGas: maxPriorityFeePerGasBN.toFixed(),
                maxFeePerGas: baseFee
                  .plus(maxPriorityFeePerGasBN)
                  // .minus(1)
                  .toFixed(),
              };
            }),
          };
        }

        const {
          baseFeePerGas,
          reward,
        }: { baseFeePerGas: Array<string>; reward: Array<Array<string>> } =
          await this.getClient(networkId).then((client) =>
            (client as Geth).rpc.call('eth_feeHistory', [
              20,
              'latest',
              [5, 25, 60],
            ]),
          );
        const baseFee = new BigNumber(baseFeePerGas.pop() as string).shiftedBy(
          -9,
        );
        const [lows, mediums, highs]: [
          Array<BigNumber>,
          Array<BigNumber>,
          Array<BigNumber>,
        ] = [[], [], []];
        reward.forEach((priorityFees: Array<string>) => {
          lows.push(new BigNumber(priorityFees[0]));
          mediums.push(new BigNumber(priorityFees[1]));
          highs.push(new BigNumber(priorityFees[2]));
        });
        const coefficients = ['1.13', '1.25', '1.3'].map(
          (c) => new BigNumber(c),
        );
        return {
          prices: [lows, mediums, highs].map((rewardList, index) => {
            const coefficient = coefficients[index];
            const maxPriorityFeePerGas = rewardList
              .sort((a, b) => (a.gt(b) ? 1 : -1))[11]
              .shiftedBy(-9);
            return {
              baseFee: baseFee.toFixed(),
              maxPriorityFeePerGas: maxPriorityFeePerGas.toFixed(),
              maxFeePerGas: baseFee
                .times(new BigNumber(coefficient))
                .plus(maxPriorityFeePerGas)
                .toFixed(),
            };
          }),
        };
      }
    } else {
      const count = 3;
      const result = await this.getFeePricePerUnit(networkId);
      if (result) {
        return {
          prices: [result.normal, ...(result.others || [])]
            .sort((a, b) => (a.price.gt(b.price) ? 1 : -1))
            .map((p) => p.price)
            .slice(0, count),
        };
      }
    }
  }

  async getGasInfoFromApi(
    networkId: string,
  ): Promise<Partial<MetaMaskGasInfo & BlockNativeGasInfo>> {
    return new Promise((resolve, reject) => {
      let metaMaskGasInfoInit = false;
      let metaMaskGasInfo: MetaMaskGasInfo | null = null;
      let blockNativeGasInfoInit = false;
      let blockNativeGasInfo: BlockNativeGasInfo | null = null;
      getBlockNativeGasInfo({ networkId })
        .then((gasInfo) => {
          blockNativeGasInfo = gasInfo;
        })
        .catch((e) => console.warn(e))
        .finally(() => {
          blockNativeGasInfoInit = true;
          if (metaMaskGasInfoInit) {
            if (blockNativeGasInfo || metaMaskGasInfo) {
              resolve({
                ...metaMaskGasInfo,
                ...blockNativeGasInfo,
              });
            } else {
              reject(new Error('failed to fetch gas info from API'));
            }
          }
        });
      getMetaMaskGasInfo(networkId)
        .then((gasInfo) => {
          metaMaskGasInfo = gasInfo;
        })
        .catch((e) => console.warn(e))
        .finally(() => {
          metaMaskGasInfoInit = true;
          if (blockNativeGasInfoInit) {
            if (blockNativeGasInfo || metaMaskGasInfo) {
              resolve({
                ...metaMaskGasInfo,
                ...blockNativeGasInfo,
              });
            } else {
              reject(new Error('failed to fetch gas info from API'));
            }
          }
        });
    });
  }

  // Wrap to throw JSON RPC errors
  override async buildUnsignedTx(
    networkId: string,
    unsignedTx: UnsignedTx,
  ): Promise<UnsignedTx> {
    try {
      return await super.buildUnsignedTx(networkId, unsignedTx);
    } catch (e) {
      throw extractResponseError(e);
    }
  }

  // Wrap to throw JSON RPC errors
  override async broadcastTransaction(
    networkId: string,
    rawTx: string,
    options?: any,
  ): Promise<string> {
    try {
      return await super.broadcastTransaction(networkId, rawTx, options);
    } catch (e) {
      throw extractResponseError(e);
    }
  }
}

export { fromDBNetworkToChainInfo, ProviderController, extractResponseError };
