import { CKDPub } from '@onekeyfe/blockchain-libs/dist/secret';
import BigNumber from 'bignumber.js';
import * as BitcoinJS from 'bitcoinjs-lib';
import bs58check from 'bs58check';
import memoziee from 'memoizee';

import { getBlockBook } from './blockbook';
import { Network, getNetwork } from './networks';
import {
  AddressEncodings,
  AddressValidation,
  ChainInfo,
  UnsignedTx,
} from './types';
import { PLACEHOLDER_VSIZE, estimateVsize, loadOPReturn } from './vsize';

type GetAccountParams =
  | {
      type: 'simple';
      xpub: string;
    }
  | {
      type: 'details';
      xpub: string;
    }
  | {
      type: 'history';
      xpub: string;
      to?: number;
    };

type ErrorType = undefined | string | Error;
const check = (statement: any, orError?: ErrorType) => {
  let error;
  if (!statement) {
    error = orError || 'Invalid statement';
    error = orError instanceof Error ? orError : new Error(orError);

    throw error;
  }
};

class Provider {
  readonly chainInfo: ChainInfo;

  private _versionBytesToEncodings?: {
    public: Record<number, AddressEncodings[]>;
    private: Record<number, AddressEncodings[]>;
  };

  constructor(chainInfo: ChainInfo) {
    this.chainInfo = chainInfo;
  }

  get network(): Network {
    return getNetwork(this.chainInfo.code);
  }

  get blockbook() {
    return getBlockBook(this.chainInfo);
  }

  get versionBytesToEncodings(): {
    public: Record<number, Array<AddressEncodings>>;
    private: Record<number, Array<AddressEncodings>>;
  } {
    if (typeof this._versionBytesToEncodings === 'undefined') {
      const { network } = this;
      const tmp = {
        public: { [network.bip32.public]: [AddressEncodings.P2PKH] },
        private: { [network.bip32.private]: [AddressEncodings.P2PKH] },
      };
      Object.entries(network.segwitVersionBytes || {}).forEach(
        ([
          encoding,
          { public: publicVersionBytes, private: privateVersionBytes },
        ]) => {
          tmp.public[publicVersionBytes] = [
            ...(tmp.public[publicVersionBytes] || []),
            encoding as AddressEncodings,
          ];
          tmp.private[privateVersionBytes] = [
            ...(tmp.private[privateVersionBytes] || []),
            encoding as AddressEncodings,
          ];
        },
      );
      this._versionBytesToEncodings = tmp;
    }
    return this._versionBytesToEncodings;
  }

  xpubToAddresses(
    xpub: string,
    relativePaths: Array<string>,
    addressEncoding?: AddressEncodings,
  ): Record<string, string> {
    // Only used to generate addresses locally.
    const decodedXpub = bs58check.decode(xpub);
    const versionBytes = parseInt(decodedXpub.slice(0, 4).toString('hex'), 16);
    const encoding =
      addressEncoding ?? this.versionBytesToEncodings.public[versionBytes][0];

    const ret: Record<string, string> = {};

    const startExtendedKey = {
      chainCode: decodedXpub.slice(13, 45),
      key: decodedXpub.slice(45, 78),
    };

    const cache = new Map();
    for (const path of relativePaths) {
      let extendedKey = startExtendedKey;
      let relPath = '';

      const parts = path.split('/');
      for (const part of parts) {
        relPath += relPath === '' ? part : `/${part}`;
        if (cache.has(relPath)) {
          extendedKey = cache.get(relPath);
          // eslint-disable-next-line no-continue
          continue;
        }

        const index = part.endsWith("'")
          ? parseInt(part.slice(0, -1)) + 2 ** 31
          : parseInt(part);
        extendedKey = CKDPub('secp256k1', extendedKey, index);
        cache.set(relPath, extendedKey);
      }

      const { address } = this.pubkeyToPayment(extendedKey.key, encoding);
      if (typeof address === 'string' && address.length > 0) {
        ret[path] = address;
      }
    }

    return ret;
  }

  private pubkeyToPayment(
    pubkey: Buffer,
    encoding: AddressEncodings,
  ): BitcoinJS.Payment {
    let payment: BitcoinJS.Payment = {
      pubkey,
      network: this.network,
    };

    switch (encoding) {
      case AddressEncodings.P2PKH:
        payment = BitcoinJS.payments.p2pkh(payment);
        break;

      case AddressEncodings.P2WPKH:
        payment = BitcoinJS.payments.p2wpkh(payment);
        break;

      case AddressEncodings.P2SH_P2WPKH:
        payment = BitcoinJS.payments.p2sh({
          redeem: BitcoinJS.payments.p2wpkh(payment),
          network: this.network,
        });
        break;

      default:
        throw new Error(`Invalid encoding: ${encoding as string}`);
    }

    return payment;
  }

  private parseAddressEncodings(addresses: string[]): Promise<string[]> {
    return Promise.all(
      addresses.map((address) => this.verifyAddress(address)),
    ).then((results) =>
      results
        .filter((i) => i.isValid)
        .map((i) => (i as { encoding: string }).encoding),
    );
  }

  getAccount(params: GetAccountParams, addressEncoding?: AddressEncodings) {
    const decodedXpub = bs58check.decode(params.xpub);
    check(this.isValidXpub(decodedXpub));
    const versionBytes = parseInt(decodedXpub.slice(0, 4).toString('hex'), 16);
    const encoding =
      addressEncoding ?? this.versionBytesToEncodings.public[versionBytes][0];
    check(typeof encoding !== 'undefined');

    let usedXpub = params.xpub;
    switch (encoding) {
      case AddressEncodings.P2PKH:
        usedXpub = `pkh(${params.xpub})`;
        break;
      case AddressEncodings.P2SH_P2WPKH:
        usedXpub = `sh(wpkh(${params.xpub}))`;
        break;
      case AddressEncodings.P2WPKH:
        usedXpub = `wpkh(${params.xpub})`;
        break;
      default:
      // no-op
    }

    let requestParams = {};
    switch (params.type) {
      case 'simple':
        requestParams = { details: 'basic' };
        break;
      case 'details':
        requestParams = { details: 'tokenBalances', tokens: 'derived' };
        break;
      case 'history':
        requestParams = { details: 'txs', pageSize: 50, to: params.to };
        break;
      default:
      // no-op
    }

    return this.blockbook.then((client) =>
      client.getAccount(usedXpub, requestParams),
    );
  }

  isValidXpub(xpub: string | Buffer): boolean {
    return this.isValidExtendedKey(xpub, 'pub');
  }

  isValidXprv(xprv: string | Buffer): boolean {
    return this.isValidExtendedKey(xprv, 'prv');
  }

  private isValidExtendedKey(
    xkey: string | Buffer,
    category: 'pub' | 'prv',
  ): boolean {
    const decodedXkey =
      typeof xkey === 'string' ? bs58check.decode(xkey) : xkey;
    if (decodedXkey.length !== 78) {
      return false;
    }
    const versionBytes = parseInt(decodedXkey.slice(0, 4).toString('hex'), 16);
    if (category === 'pub') {
      return (
        typeof this.versionBytesToEncodings.public[versionBytes] !== 'undefined'
      );
    }
    return (
      typeof this.versionBytesToEncodings.private[versionBytes] !== 'undefined'
    );
  }

  verifyAddress(address: string): AddressValidation {
    let encoding: string | undefined;

    try {
      const decoded = BitcoinJS.address.fromBase58Check(address);
      if (
        decoded.version === this.network.pubKeyHash &&
        decoded.hash.length === 20
      ) {
        encoding = AddressEncodings.P2PKH;
      } else if (
        decoded.version === this.network.scriptHash &&
        decoded.hash.length === 20
      ) {
        encoding = AddressEncodings.P2SH_P2WPKH;
      }
    } catch (e) {
      try {
        const decoded = BitcoinJS.address.fromBech32(address);
        if (
          decoded.version === 0x00 &&
          decoded.prefix === this.network.bech32 &&
          decoded.data.length === 20
        ) {
          encoding = AddressEncodings.P2WPKH;
        }
      } catch (_) {
        // ignore error
      }
    }

    return encoding
      ? {
          displayAddress: address,
          normalizedAddress: address,
          encoding,
          isValid: true,
        }
      : {
          isValid: false,
        };
  }

  async buildUnsignedTx(unsignedTx: UnsignedTx): Promise<UnsignedTx> {
    const {
      inputs,
      outputs,
      payload: { opReturn },
    } = unsignedTx;
    let { feeLimit, feePricePerUnit } = unsignedTx;

    if (inputs.length > 0 && outputs.length > 0) {
      const inputAddressEncodings = await this.parseAddressEncodings(
        inputs.map((i) => i.address),
      );
      const outputAddressEncodings = await this.parseAddressEncodings(
        outputs.map((i) => i.address),
      );

      if (
        inputAddressEncodings.length === inputs.length &&
        outputAddressEncodings.length === outputs.length
      ) {
        const vsize = estimateVsize(
          inputAddressEncodings,
          outputAddressEncodings,
          opReturn,
        );
        feeLimit =
          feeLimit && feeLimit.gte(vsize) ? feeLimit : new BigNumber(vsize);
      }
    }

    feeLimit = feeLimit || new BigNumber(PLACEHOLDER_VSIZE);

    return { ...unsignedTx, feeLimit, feePricePerUnit };
  }

  getBalances(
    requests: { address: string }[],
  ): Promise<(BigNumber | undefined)[]> {
    return this.blockbook.then((client) =>
      Promise.all(requests.map(({ address }) => client.getBalance(address))),
    );
  }

  getUTXOs = memoziee(
    async (xpub: string) =>
      this.blockbook.then((client) => client.getUTXOs(xpub)),
    {
      promise: true,
      max: 1,
      maxAge: 1000 * 30,
    },
  );
}

export { Provider };
