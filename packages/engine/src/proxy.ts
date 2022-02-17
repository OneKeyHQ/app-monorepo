/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint max-classes-per-file: "off" */

import { Buffer } from 'buffer';

import BigNumber from 'bignumber.js';

import { RestfulRequest } from '@onekeyhq/blockchain-libs/dist/basic/request/restful';
import { Coingecko } from '@onekeyhq/blockchain-libs/dist/price/channels/coingecko';
import { ProviderController as BaseProviderController } from '@onekeyhq/blockchain-libs/dist/provider';
import {
  BaseClient,
  BaseProvider,
  ClientFilter,
} from '@onekeyhq/blockchain-libs/dist/provider/abc';
import { Geth } from '@onekeyhq/blockchain-libs/dist/provider/chains/eth/geth';
import {
  batchGetPrivateKeys,
  sign,
  uncompressPublicKey,
} from '@onekeyhq/blockchain-libs/dist/secret';
import { ChainInfo } from '@onekeyhq/blockchain-libs/dist/types/chain';
import {
  TransactionStatus,
  UnsignedTx,
} from '@onekeyhq/blockchain-libs/dist/types/provider';
import { Signer, Verifier } from '@onekeyhq/blockchain-libs/dist/types/secret';

import { IMPL_EVM, IMPL_SOL, SEPERATOR } from './constants';
import { OneKeyInternalError } from './errors';
import { getPresetNetworks } from './presets';
import { Account, SimpleAccount } from './types/account';
import { HistoryEntryStatus } from './types/history';
import { DBNetwork, EIP1559Fee, Network } from './types/network';

const CGK_BATCH_SIZE = 100;

// IMPL naming aren't necessarily the same.
const IMPL_MAPPINGS: Record<string, string> = {
  [IMPL_EVM]: 'eth',
  [IMPL_SOL]: 'sol',
};

type Curve = 'secp256k1' | 'ed25519';

type ImplProperty = {
  defaultCurve: Curve;
  clientProvider: string;
  implOptions?: { [key: string]: any };
};

const IMPL_PROPERTIES: Record<string, ImplProperty> = {
  [IMPL_EVM]: {
    defaultCurve: 'secp256k1',
    clientProvider: 'Geth',
  },
  [IMPL_SOL]: {
    defaultCurve: 'ed25519',
    clientProvider: 'Solana',
  },
};

function fromDBNetworkToChainInfo(dbNetwork: DBNetwork): ChainInfo {
  const implProperties = IMPL_PROPERTIES[dbNetwork.impl];
  if (typeof implProperties === 'undefined') {
    throw new OneKeyInternalError('Unable to build chain info from dbNetwork.');
  }
  let implOptions = implProperties.implOptions || {};
  if (dbNetwork.impl === IMPL_EVM) {
    const chainId = parseInt(dbNetwork.id.split(SEPERATOR)[1]);
    // EIP1559 is enabled on Ethereum Mainnet, Ropsten, Rinkeby, Görli
    const EIP1559Enabled =
      chainId === 1 || chainId === 3 || chainId === 4 || chainId === 5;
    implOptions = { ...implOptions, chainId, EIP1559Enabled };
  }
  return {
    code: dbNetwork.id,
    feeCode: dbNetwork.id,
    impl: dbNetwork.impl,
    curve: (dbNetwork.curve as Curve) || implProperties.defaultCurve,
    implOptions,
    clients: [
      { name: implProperties.clientProvider, args: [dbNetwork.rpcURL] },
    ],
  };
}

function fillUnsignedTx(
  network: Network,
  account: Account,
  to: string,
  value: BigNumber,
  tokenIdOnNetwork?: string,
  extra?: { [key: string]: any },
): UnsignedTx {
  const valueOnChain = value.shiftedBy(network.decimals);
  const { type, nonce, feeLimit, feePricePerUnit, ...payload } = extra as {
    type: string;
    nonce: number;
    feeLimit: BigNumber;
    feePricePerUnit: BigNumber;
    [key: string]: any;
  };
  const { maxFeePerGas, maxPriorityFeePerGas } = payload as {
    maxFeePerGas: BigNumber;
    maxPriorityFeePerGas: BigNumber;
  };
  if (
    maxFeePerGas instanceof BigNumber &&
    maxPriorityFeePerGas instanceof BigNumber
  ) {
    payload.maxFeePerGas = maxFeePerGas.shiftedBy(network.feeDecimals);
    payload.maxPriorityFeePerGas = maxPriorityFeePerGas.shiftedBy(
      network.feeDecimals,
    );
    payload.EIP1559Enabled = true;
  }
  return {
    inputs: [
      {
        address: (account as SimpleAccount).address,
        value: valueOnChain,
        tokenAddress: tokenIdOnNetwork,
      },
    ],
    outputs: [
      {
        address: to,
        value: valueOnChain,
        tokenAddress: tokenIdOnNetwork,
      },
    ],
    type,
    nonce,
    feeLimit,
    feePricePerUnit: feePricePerUnit.shiftedBy(network.feeDecimals),
    payload,
  };
}

class ProviderController extends BaseProviderController {
  private clients: Record<string, BaseClient> = {};

  private providers: Record<string, BaseProvider> = {};

  constructor(
    private getChainInfoByNetworkId: (networkId: string) => Promise<ChainInfo>,
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

  private getVerifier(networkId: string, pub: string): Verifier {
    const provider = this.providers[networkId];
    if (typeof provider === 'undefined') {
      throw new OneKeyInternalError('Provider not found.');
    }
    const { chainInfo } = this.providers[networkId];
    const implProperties = IMPL_PROPERTIES[chainInfo.impl];
    const curve = chainInfo.curve || implProperties.defaultCurve;
    return {
      getPubkey: (compressed?: boolean) =>
        Promise.resolve(
          compressed
            ? Buffer.from(pub, 'hex')
            : uncompressPublicKey(curve, Buffer.from(pub, 'hex')),
        ),
      verify: (_digest: Buffer, _signature: Buffer) =>
        Promise.resolve(Buffer.from([])), // Not used.
    };
  }

  private getSigners(
    networkId: string,
    seed: Buffer,
    password: string,
    account: Account,
  ): { [p: string]: Signer } {
    const provider = this.providers[networkId];
    if (typeof provider === 'undefined') {
      throw new OneKeyInternalError('Provider not found.');
    }
    const { chainInfo } = this.providers[networkId];
    const implProperties = IMPL_PROPERTIES[chainInfo.impl];
    const curve = chainInfo.curve || implProperties.defaultCurve;

    return {
      [(account as SimpleAccount).address]: {
        getPubkey: (_compressed?: boolean) => Promise.resolve(Buffer.from([])),
        verify: (_digest: Buffer, _signature: Buffer) =>
          Promise.resolve(Buffer.from([])),
        getPrvkey: () => Promise.resolve(Buffer.from([])),
        sign: (digest: Buffer) => {
          const pathComponents = account.path.split('/');
          const relPath = pathComponents.pop() as string;
          const { extendedKey } = batchGetPrivateKeys(
            curve,
            seed,
            password,
            pathComponents.join('/'),
            [relPath],
          )[0];
          const signature = sign(curve, extendedKey.key, digest, password);
          if (curve === 'secp256k1') {
            return Promise.resolve([
              signature.slice(0, -1),
              signature[signature.length - 1],
            ]);
          }
          return Promise.resolve([signature, 0]);
        },
      },
    };
  }

  // TODO: set client api to support change.

  async getClient(
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

  async getProvider(networkId: string): Promise<BaseProvider> {
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

  requireChainImpl(impl: string): any {
    return super.requireChainImpl(IMPL_MAPPINGS[impl] || impl);
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

  async preSend(
    network: Network,
    account: Account,
    to: string,
    value: BigNumber,
    tokenIdOnNetwork?: string,
    extra?: { [key: string]: any },
  ): Promise<BigNumber> {
    const unsignedTx = await this.buildUnsignedTx(
      network.id,
      fillUnsignedTx(network, account, to, value, tokenIdOnNetwork, extra),
    );
    if (typeof unsignedTx.feeLimit === 'undefined') {
      throw new OneKeyInternalError('Failed to estimate gas limit.');
    }
    return unsignedTx.feeLimit;
  }

  async simpleTransfer(
    seed: Buffer,
    password: string,
    network: Network,
    account: Account,
    to: string,
    value: BigNumber,
    tokenIdOnNetwork?: string,
    extra?: { [key: string]: any },
  ): Promise<{ txid: string; rawTx: string; success: boolean }> {
    const unsignedTx = await this.buildUnsignedTx(
      network.id,
      fillUnsignedTx(network, account, to, value, tokenIdOnNetwork, extra),
    );
    const { txid, rawTx } = await this.signTransaction(
      network.id,
      unsignedTx,
      this.getSigners(network.id, seed, password, account),
    );
    return {
      txid,
      rawTx,
      success: await this.broadcastTransaction(network.id, rawTx),
    };
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
            baseFee,
            maxPriorityFeePerGas: new BigNumber(
              p.suggestedMaxPriorityFeePerGas,
            ),
            maxFeePerGas: new BigNumber(p.suggestedMaxFeePerGas),
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
            baseFee,
            maxPriorityFeePerGas,
            maxFeePerGas: baseFee
              .times(new BigNumber(coefficient))
              .plus(maxPriorityFeePerGas),
          };
        });
      }
    } else {
      const result = await this.getFeePricePerUnit(networkId);
      return [result.normal, ...(result.others || [])]
        .sort((a, b) => (a.price.gt(b.price) ? 1 : -1))
        .map((p) => p.price)
        .slice(0, 1);
    }
  }

  async refreshPendingTxs(
    networkId: string,
    pendingTxs: Array<string>,
  ): Promise<Record<string, HistoryEntryStatus>> {
    if (pendingTxs.length === 0) {
      return {};
    }

    const ret: Record<string, HistoryEntryStatus> = {};
    const regex = new RegExp(`^${networkId}${SEPERATOR}`);
    const updatedStatuses = await this.getTransactionStatuses(
      networkId,
      pendingTxs.map((entryId) => entryId.replace(regex, '')),
    );
    updatedStatuses.forEach((status, index) => {
      const entryId = pendingTxs[index];
      if (
        status === TransactionStatus.NOT_FOUND ||
        status === TransactionStatus.INVALID
      ) {
        ret[entryId] = HistoryEntryStatus.DROPPED;
      } else if (status === TransactionStatus.CONFIRM_AND_SUCCESS) {
        ret[entryId] = HistoryEntryStatus.SUCCESS;
      } else if (status === TransactionStatus.CONFIRM_BUT_FAILED) {
        ret[entryId] = HistoryEntryStatus.FAILED;
      }
    });

    return ret;
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

    const channels = (getPresetNetworks()[networkId].prices || []).reduce(
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

export { fromDBNetworkToChainInfo, ProviderController, PriceController };
