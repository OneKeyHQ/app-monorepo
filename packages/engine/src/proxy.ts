/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint max-classes-per-file: "off" */

import { Buffer } from 'buffer';

import {
  encode as toCfxAddress,
  decode as toEthAddress,
} from '@conflux-dev/conflux-address-js';
import { RestfulRequest } from '@onekeyfe/blockchain-libs/dist/basic/request/restful';
import { Coingecko } from '@onekeyfe/blockchain-libs/dist/price/channels/coingecko';
import { ProviderController as BaseProviderController } from '@onekeyfe/blockchain-libs/dist/provider';
import {
  BaseClient,
  BaseProvider,
  ClientFilter,
} from '@onekeyfe/blockchain-libs/dist/provider/abc';
import { BlockBook } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/blockbook';
import { Geth } from '@onekeyfe/blockchain-libs/dist/provider/chains/eth/geth';
import {
  N,
  sign,
  uncompressPublicKey,
} from '@onekeyfe/blockchain-libs/dist/secret';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { ChainInfo } from '@onekeyfe/blockchain-libs/dist/types/chain';
import {
  TransactionStatus,
  TxInput,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import {
  Signer as ISigner,
  Verifier as IVerifier,
} from '@onekeyfe/blockchain-libs/dist/types/secret';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import {
  IMPL_ALGO,
  IMPL_BTC,
  IMPL_CFX,
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_SOL,
  IMPL_STC,
  SEPERATOR,
} from './constants';
import { NotImplemented, OneKeyInternalError } from './errors';
import { getCurveByImpl } from './managers/impl';
import { getImplFromNetworkId } from './managers/network';
import { getPresetNetworks } from './presets';
import {
  AccountType,
  DBAccount,
  DBSimpleAccount,
  DBUTXOAccount,
  DBVariantAccount,
} from './types/account';
import { HistoryEntryStatus } from './types/history';
import { DBNetwork, EIP1559Fee, Network } from './types/network';
import { Token } from './types/token';

const CGK_BATCH_SIZE = 100;

// IMPL naming aren't necessarily the same.
const IMPL_MAPPINGS: Record<
  string,
  { implName?: string; defaultClient: string }
> = {
  [IMPL_EVM]: { implName: 'eth', defaultClient: 'Geth' },
  [IMPL_SOL]: { defaultClient: 'Solana' },
  [IMPL_ALGO]: { defaultClient: 'Algod' },
  [IMPL_NEAR]: { defaultClient: 'NearCli' },
  [IMPL_STC]: { defaultClient: 'StcClient' },
  [IMPL_CFX]: { defaultClient: 'Conflux' },
  [IMPL_BTC]: { defaultClient: 'BlockBook' },
};

type Curve = 'secp256k1' | 'ed25519';

function fromDBNetworkToChainInfo(dbNetwork: DBNetwork): ChainInfo {
  const defaultClient = IMPL_MAPPINGS[dbNetwork.impl]?.defaultClient;
  if (typeof defaultClient === 'undefined') {
    throw new OneKeyInternalError('Unable to build chain info from dbNetwork.');
  }

  let providerOptions: Record<string, any> = {};

  const presetNetwork = getPresetNetworks()[dbNetwork.id];
  if (typeof presetNetwork !== 'undefined') {
    ({ providerOptions } = presetNetwork.extensions || { providerOptions: {} });
  }

  let implOptions = providerOptions || {};

  const chainId = parseInt(dbNetwork.id.split(SEPERATOR)[1]);
  implOptions = { ...implOptions, chainId };

  let code = dbNetwork.id;
  if (dbNetwork.impl === IMPL_BTC) {
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
            ? [dbNetwork.rpcURL, { url: `${dbNetwork.rpcURL}/idx2` }]
            : [dbNetwork.rpcURL],
      },
    ],
  };
}

export function fillUnsignedTxObj({
  network,
  dbAccount,
  to,
  value,
  valueOnChain,
  token,
  extra,
  shiftFeeDecimals = false,
}: {
  network: Network;
  dbAccount: DBAccount;
  to: string;
  value?: BigNumber;
  valueOnChain?: string;
  token?: Token;
  extra?: { [key: string]: any };
  shiftFeeDecimals?: boolean;
}): UnsignedTx {
  let valueOnChainBN = new BigNumber(0);
  let tokenIdOnNetwork: string | undefined;
  if (valueOnChain) {
    valueOnChainBN = new BigNumber(valueOnChain);
  } else if (!isNil(value)) {
    valueOnChainBN = value;
    if (typeof token !== 'undefined') {
      valueOnChainBN = valueOnChainBN.shiftedBy(token.decimals);
      tokenIdOnNetwork = token.tokenIdOnNetwork;
    } else {
      valueOnChainBN = valueOnChainBN.shiftedBy(network.decimals);
    }
  }

  const { type, nonce, feeLimit, feePricePerUnit, ...payload } = extra as {
    type?: string;
    nonce?: number;
    feeLimit?: BigNumber;
    feePricePerUnit?: BigNumber;
    [key: string]: any;
  };
  const { maxFeePerGas, maxPriorityFeePerGas } = payload as {
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  };
  // EIP 1559
  const eip1559 =
    typeof maxFeePerGas === 'string' &&
    typeof maxPriorityFeePerGas === 'string';
  if (eip1559) {
    let maxFeePerGasBN = new BigNumber(maxFeePerGas);
    let maxPriorityFeePerGasBN = new BigNumber(maxPriorityFeePerGas);

    if (shiftFeeDecimals) {
      maxFeePerGasBN = maxFeePerGasBN.shiftedBy(network.feeDecimals);
      maxPriorityFeePerGasBN = maxPriorityFeePerGasBN.shiftedBy(
        network.feeDecimals,
      );
    }
    payload.maxFeePerGas = maxFeePerGasBN;
    payload.maxPriorityFeePerGas = maxPriorityFeePerGasBN;
    payload.EIP1559Enabled = true;
  }
  const input: TxInput = {
    address: dbAccount.address,
    value: valueOnChainBN,
    tokenAddress: tokenIdOnNetwork,
  };
  if (network.impl === IMPL_STC) {
    input.publicKey = (dbAccount as DBSimpleAccount).pub;
  }

  let feePricePerUnitBN = feePricePerUnit;
  if (shiftFeeDecimals) {
    feePricePerUnitBN = feePricePerUnitBN?.shiftedBy(network.feeDecimals);
  }
  // TODO remove hack for eip1559 gasPrice=1
  if (eip1559) {
    feePricePerUnitBN = new BigNumber(1);
  }

  return {
    inputs: [input],
    outputs: [
      {
        address: to || '',
        value: valueOnChainBN,
        tokenAddress: tokenIdOnNetwork,
      },
    ],
    type,
    nonce,
    feeLimit,
    feePricePerUnit: feePricePerUnitBN,
    payload,
  };
}

export function fillUnsignedTx(
  network: Network,
  dbAccount: DBAccount,
  to: string,
  value: BigNumber,
  token?: Token,
  extra?: { [key: string]: any },
): UnsignedTx {
  return fillUnsignedTxObj({
    network,
    dbAccount,
    to,
    value,
    token,
    extra,
  });
}

class Verifier implements IVerifier {
  private uncompressedPublicKey: Buffer;

  private compressedPublicKey: Buffer;

  constructor(pub: string, curve: Curve) {
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
}

export class Signer extends Verifier implements ISigner {
  constructor(
    private encryptedPrivateKey: Buffer,
    private password: string,
    private curve: Curve,
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

  override async getClient(
    networkId: string,
    filter?: ClientFilter,
  ): Promise<BaseClient> {
    const filterClient = filter || (() => true);

    if (typeof this.clients[networkId] === 'undefined') {
      const chainInfo = await this.getChainInfoByNetworkId(networkId);
      const module = this.requireChainImpl(chainInfo.impl);
      const { name, args } = chainInfo.clients[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (typeof module[name] !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        this.clients[networkId] = new module[name](...args);
        this.clients[networkId].setChainInfo(chainInfo);
      }
    }

    const client = this.clients[networkId];

    if (typeof client !== 'undefined' && filterClient(client)) {
      return Promise.resolve(client);
    }
    return Promise.reject(new OneKeyInternalError('Unable to init client.'));
  }

  override async getProvider(networkId: string): Promise<BaseProvider> {
    if (typeof this.providers[networkId] === 'undefined') {
      const chainInfo = await this.getChainInfoByNetworkId(networkId);
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

  addressFromBase(networkId: string, baseAddress: string): Promise<string> {
    const [impl, chainId] = networkId.split(SEPERATOR);
    switch (impl) {
      case IMPL_CFX:
        return Promise.resolve(toCfxAddress(baseAddress, parseInt(chainId)));
      default:
        throw new NotImplemented();
    }
  }

  addressToBase(networkId: string, address: string): Promise<string> {
    const [impl] = networkId.split(SEPERATOR);
    switch (impl) {
      case IMPL_CFX:
        return Promise.resolve(
          `0x${toEthAddress(address).hexAddress.toString('hex')}`,
        );
      default:
        throw new NotImplemented();
    }
  }

  public async selectAccountAddress(
    networkId: string,
    dbAccount: DBAccount,
  ): Promise<string> {
    let address;
    switch (dbAccount.type) {
      case AccountType.SIMPLE:
        address = dbAccount.address;
        break;
      case AccountType.VARIANT:
        address = ((dbAccount as DBVariantAccount).addresses || {})[networkId];
        if (typeof address === 'undefined') {
          address = await this.addressFromBase(networkId, dbAccount.address);
        }
        break;
      case AccountType.UTXO:
        address = (dbAccount as DBUTXOAccount).xpub;
        break;
      default:
        throw new NotImplemented();
    }
    return Promise.resolve(address);
  }

  override async getBalances(
    networkId: string,
    requests: Array<any>,
  ): Promise<Array<BigNumber | undefined>> {
    if (getImplFromNetworkId(networkId) === IMPL_BTC) {
      const provider = await this.getProvider(networkId);
      const { restful } = await (
        provider as unknown as { blockbook: Promise<BlockBook> }
      ).blockbook;
      return Promise.all(
        requests.map(({ address }: { address: string }) =>
          restful
            .get(`/api/v2/xpub/${address}`, { details: 'basic' })
            .then((r) => r.json())
            .then((r: { balance: string }) => new BigNumber(r.balance))
            .catch(() => undefined),
        ),
      );
    }
    return super.getBalances(networkId, requests);
  }

  // TODO: move this into vaults.
  async proxyGetBalances(
    networkId: string,
    target: Array<string> | DBAccount,
    tokenIds: Array<string>,
    withMain = true,
  ): Promise<Array<BigNumber | undefined>> {
    if (Array.isArray(target)) {
      // TODO: switch by network id.
      return this.getBalances(
        networkId,
        target.map((address) => ({ address, coin: {} })),
      );
    }

    const address = await this.selectAccountAddress(networkId, target);
    return this.getBalances(
      networkId,
      (withMain ? [{ address, coin: {} }] : []).concat(
        tokenIds.map((tokenId) => ({
          address,
          coin: { tokenAddress: tokenId },
        })),
      ),
    );
  }

  async preSend(
    network: Network,
    dbAccount: DBAccount,
    to: string,
    value: BigNumber,
    token?: Token,
    extra?: { [key: string]: any },
  ): Promise<BigNumber> {
    dbAccount.address = await this.selectAccountAddress(network.id, dbAccount);
    const unsignedTx = await this.buildUnsignedTx(
      network.id,
      fillUnsignedTx(network, dbAccount, to, value, token, extra),
    );
    if (typeof unsignedTx.feeLimit === 'undefined') {
      throw new OneKeyInternalError('Failed to estimate gas limit.');
    }
    return unsignedTx.feeLimit;
  }

  async getGasPrice(networkId: string): Promise<Array<BigNumber | EIP1559Fee>> {
    // TODO: move this into libs.
    const { chainId, EIP1559Enabled } =
      (await this.getProvider(networkId)).chainInfo.implOptions || {};
    if (EIP1559Enabled || false) {
      try {
        const request = new RestfulRequest(
          `https://gas-api.metaswap.codefi.network/networks/${parseInt(
            chainId,
          )}/suggestedGasFees`,
        );
        const { low, medium, high, estimatedBaseFee } = await request
          .get('')
          .then((i) => i.json());
        const baseFee = new BigNumber(estimatedBaseFee);
        return [low, medium, high].map(
          (p: {
            suggestedMaxPriorityFeePerGas: string;
            suggestedMaxFeePerGas: string;
          }) => ({
            baseFee: baseFee.toFixed(),
            maxPriorityFeePerGas: new BigNumber(
              p.suggestedMaxPriorityFeePerGas,
            ).toFixed(),
            maxFeePerGas: new BigNumber(p.suggestedMaxFeePerGas).toFixed(),
          }),
        );
      } catch {
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
        return [lows, mediums, highs].map((rewardList, index) => {
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
        });
      }
    } else {
      const count = 3;
      const result = await this.getFeePricePerUnit(networkId);
      return [result.normal, ...(result.others || [])]
        .sort((a, b) => (a.price.gt(b.price) ? 1 : -1))
        .map((p) => p.price)
        .slice(0, count);
    }
  }

  async refreshPendingTxs(
    networkId: string,
    pendingTxs: Array<{ id: string }>,
  ): Promise<Record<string, HistoryEntryStatus>> {
    if (pendingTxs.length === 0) {
      return {};
    }

    const ret: Record<string, HistoryEntryStatus> = {};
    const regex = new RegExp(`^${networkId}${SEPERATOR}`);
    const updatedStatuses = await this.getTransactionStatuses(
      networkId,
      pendingTxs.map((tx) => tx.id.replace(regex, '')),
    );

    updatedStatuses.forEach((status, index) => {
      const { id } = pendingTxs[index];
      if (status === TransactionStatus.CONFIRM_AND_SUCCESS) {
        ret[id] = HistoryEntryStatus.SUCCESS;
      } else if (status === TransactionStatus.CONFIRM_BUT_FAILED) {
        ret[id] = HistoryEntryStatus.FAILED;
      }
    });

    return ret;
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
  ): Promise<string> {
    try {
      return await super.broadcastTransaction(networkId, rawTx);
    } catch (e) {
      throw extractResponseError(e);
    }
  }
}

class PriceController {
  private cgk: Coingecko;

  constructor() {
    this.cgk = new Coingecko();
  }

  async getFiats(fiats: Set<string>): Promise<Record<string, BigNumber>> {
    const ret: Record<string, BigNumber> = { 'usd': new BigNumber('1') };
    let rates: Record<string, { value: number }>;
    try {
      const response = await this.cgk.fetchApi('/api/v3/exchange_rates');
      rates = (
        (await response.json()) as { rates: Record<string, { value: number }> }
      ).rates;
    } catch (e) {
      console.error(e);
      return Promise.reject(new Error('Failed to get fiat rates.'));
    }

    if (typeof rates.usd === 'undefined') {
      return Promise.reject(new Error('Failed to get fiat rates.'));
    }

    const btcToUsd = new BigNumber(rates.usd.value);
    ret.btc = new BigNumber(1).div(btcToUsd);
    fiats.forEach((fiat) => {
      if (fiat !== 'usd' && typeof rates[fiat] !== 'undefined') {
        ret[fiat] = new BigNumber(rates[fiat].value).div(btcToUsd);
      }
    });
    return ret;
  }

  private async getCgkTokensPrice(
    platform: string,
    addresses: Array<string>,
  ): Promise<Record<string, BigNumber>> {
    if (addresses.length > CGK_BATCH_SIZE) {
      return {};
    }
    const ret: Record<string, BigNumber> = {};
    try {
      const response = await this.cgk.fetchApi(
        `/api/v3/simple/token_price/${platform}`,
        {
          contract_addresses: addresses.join(','),
          vs_currencies: 'usd',
        },
      );
      const prices = (await response.json()) as Record<string, { usd: number }>;
      for (const [address, value] of Object.entries(prices)) {
        if (typeof value.usd === 'number') {
          ret[address] = new BigNumber(value.usd);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return ret;
  }

  async getPrices(
    networkId: string,
    tokenIdOnNetwork: Array<string>,
    withMain = true,
  ): Promise<Record<string, BigNumber>> {
    const ret: Record<string, BigNumber> = {};

    const channels = (getPresetNetworks()[networkId]?.prices || []).reduce(
      (obj, item) => ({ ...obj, [item.channel]: item }),
      {},
    );
    const cgkChannel = channels.coingecko as {
      channel: string;
      native: string;
      platform: string;
    };
    if (typeof cgkChannel === 'undefined') {
      return ret;
    }

    if (withMain && typeof cgkChannel.native !== 'undefined') {
      try {
        const response = await this.cgk.fetchApi('/api/v3/simple/price', {
          ids: cgkChannel.native,
          vs_currencies: 'usd',
        });
        ret.main = new BigNumber(
          ((await response.json()) as Record<string, { usd: number }>)[
            cgkChannel.native
          ].usd,
        );
      } catch (e) {
        console.error(e);
      }
    }

    if (typeof cgkChannel.platform !== 'undefined') {
      const batchSize = CGK_BATCH_SIZE;
      for (let i = 0; i < tokenIdOnNetwork.length; i += batchSize) {
        Object.assign(
          ret,
          await this.getCgkTokensPrice(
            cgkChannel.platform,
            tokenIdOnNetwork.slice(i, i + batchSize),
          ),
        );
      }
    }

    return ret;
  }
}

export {
  fromDBNetworkToChainInfo,
  ProviderController,
  PriceController,
  extractResponseError,
};
