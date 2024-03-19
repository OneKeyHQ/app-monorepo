import BigNumber from 'bignumber.js';
import { mnemonicToSeedSync } from 'bip39';
import * as BitcoinJS from 'bitcoinjs-lib';
import bitcoinMessage from 'bitcoinjs-message';
import bs58check from 'bs58check';
import { encode } from 'varuint-bitcoin';

import {
  CKDPub,
  mnemonicFromEntropy,
  verify,
} from '@onekeyhq/engine/src/secret';
import { AddressEncodings } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import type {
  AddressValidation,
  ChainInfo,
  ICollectUTXOsOptions,
  SignedTx,
  Signer,
  TransactionMixin,
  TransactionStatus,
  UTXO,
  UnsignedTx,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import type { InputToSign } from '@onekeyhq/shared/src/providerApis/ProviderApiBtc/ProviderApiBtc.types';
import { getInputsToSignFromPsbt } from '@onekeyhq/shared/src/providerApis/ProviderApiBtc/ProviderApiBtc.utils';
import { isBRC20Token } from '@onekeyhq/shared/src/utils/tokenUtils';

import {
  getBitcoinBip32,
  getBitcoinECPair,
  initBitcoinEcc,
  isTaprootXpubSegwit,
  isWatchAccountTaprootSegwit,
} from '../utils';

import { getBlockBook } from './blockbook';
import { getNetwork } from './networks';
import { PLACEHOLDER_VSIZE, estimateTxSize, loadOPReturn } from './vsize';

import type { Account } from '../../../../types/account';
import type { IUnsignedTxPro } from '../../../types';
import type { Network } from './networks';
import type { PsbtInput } from 'bip174/src/lib/interfaces';
import type { SignatureOptions } from 'bitcoinjs-message';
import type { ECPairInterface } from 'ecpair';

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
    }
  | {
      type: 'usedAddress';
      xpub: string;
    }
  | {
      type: 'accountInfo';
      xpub: string;
      details: string;
      from?: number;
      to?: number;
      pageSize?: number;
    };

type GetAccountWithAddressParams = {
  type: 'simple';
  address: string;
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

const checkIsDefined = <T>(something?: T, orError?: ErrorType): T => {
  check(
    typeof something !== 'undefined',
    orError || 'Expect defined but actually undefined',
  );
  return something as T;
};

const bip0322Hash = (message: string) => {
  const { sha256 } = BitcoinJS.crypto;
  const tag = 'BIP0322-signed-message';
  const tagHash = sha256(Buffer.from(tag));
  const result = sha256(
    Buffer.concat([tagHash, tagHash, Buffer.from(message)]),
  );
  return result.toString('hex');
};

const encodeVarString = (buffer: Buffer) =>
  Buffer.concat([encode(buffer.byteLength), buffer]);

const validator = (
  pubkey: Buffer,
  msghash: Buffer,
  signature: Buffer,
): boolean => verify('secp256k1', pubkey, msghash, signature);

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
    // client: axios
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

  decodeAddress(address: string) {
    return address;
  }

  encodeAddress(address: string) {
    return address;
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
    // const leaf = null;
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

      // const pubkey = taproot && inscribe ? fixedPublickey : extendedKey.key;
      let { address } = this.pubkeyToPayment(extendedKey.key, encoding);
      if (typeof address === 'string' && address.length > 0) {
        address = this.encodeAddress(address);
        ret[path] = address;
      }
    }
    return ret;
  }

  private pubkeyToPayment(
    pubkey: Buffer,
    encoding: AddressEncodings,
  ): BitcoinJS.Payment {
    initBitcoinEcc();
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
      case AddressEncodings.P2TR:
        payment = BitcoinJS.payments.p2tr({
          internalPubkey: pubkey.slice(1, 33),
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
    const usedXpub = this.getEncodingXpub({ params, addressEncoding });

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
      case 'usedAddress':
        requestParams = { details: 'tokenBalances', tokens: 'used' };
        break;
      case 'accountInfo':
        requestParams = {
          details: params.details,
          from: params.from,
          to: params.to,
          pageSize: params.pageSize,
        };
        break;
      default: {
        const exhaustiveCheck: never = params;
        // To make sure we have handled all types
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`type not support: ${exhaustiveCheck.type}`);
      }
    }

    return this.blockbook.then((client) =>
      client.getAccount(usedXpub, requestParams),
    );
  }

  getAccountWithAddress(params: GetAccountWithAddressParams) {
    let requestParams = {};
    switch (params.type) {
      case 'simple':
        requestParams = { details: 'basic' };
        break;
      default:
      // no-op
    }

    return this.blockbook.then((client) =>
      client.getAccountWithAddress(params.address, requestParams),
    );
  }

  private getEncodingXpub({
    params,
    addressEncoding,
    safeGet,
  }: {
    params: GetAccountParams;
    addressEncoding?: AddressEncodings;
    safeGet?: boolean;
  }) {
    if (!params.xpub) {
      if (safeGet) {
        return '';
      }
      throw new Error('getEncodingXpub ERROR: xpub is required');
    }
    let encoding = addressEncoding;
    if (
      isTaprootXpubSegwit(params.xpub) ||
      isWatchAccountTaprootSegwit(params.xpub)
    ) {
      encoding = AddressEncodings.P2TR;
    } else {
      const decodedXpub = bs58check.decode(params.xpub);
      check(this.isValidXpub(decodedXpub));
      const versionBytes = parseInt(
        decodedXpub.slice(0, 4).toString('hex'),
        16,
      );
      encoding =
        addressEncoding ?? this.versionBytesToEncodings.public[versionBytes][0];
    }
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
      case AddressEncodings.P2TR:
        usedXpub = params.xpub;
        break;
      default:
      // no-op
    }

    return usedXpub;
  }

  getHistory(
    params: GetAccountParams,
    network: string,
    networkId: string,
    address: string,
    symbol: string,
    decimals: number,
  ) {
    const usedXpub = this.getEncodingXpub({ params, safeGet: true });
    return this.blockbook.then((client) =>
      client.getHistory(
        network,
        networkId,
        address,
        usedXpub,
        symbol,
        decimals,
      ),
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

  verifyAddress(addr: string): AddressValidation {
    let encoding: string | undefined;
    const address = this.decodeAddress(addr);

    if (isBRC20Token(address))
      return {
        isValid: true,
        normalizedAddress: address,
        displayAddress: address,
      };

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
        } else if (
          decoded.version === 0x00 &&
          decoded.prefix === this.network.bech32 &&
          decoded.data.length === 32
        ) {
          encoding = AddressEncodings.P2WSH;
        } else if (
          decoded.version === 0x01 &&
          decoded.prefix === this.network.bech32 &&
          decoded.data.length === 32
        ) {
          encoding = AddressEncodings.P2TR;
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

  buildUnsignedTx(unsignedTx: UnsignedTx): Promise<UnsignedTx> {
    const { encodedTx, inputs, outputs } = unsignedTx;
    let { feeLimit, feePricePerUnit } = unsignedTx;
    const { inputsForCoinSelect } = encodedTx ?? {};

    const selectedInputs = inputsForCoinSelect?.filter((input) =>
      inputs.some(
        (i) => i.utxo?.txid === input.txId && i.utxo.vout === input.vout,
      ),
    );
    if (Number(selectedInputs?.length) > 0 && outputs.length > 0) {
      const txSize = estimateTxSize(
        selectedInputs ?? [],
        outputs.map((o) => ({
          address: o.address,
          value: parseInt(o.value.toFixed()),
        })) ?? [],
      );
      feeLimit =
        feeLimit && feeLimit.gte(txSize) ? feeLimit : new BigNumber(txSize);
    }

    feeLimit = feeLimit || new BigNumber(PLACEHOLDER_VSIZE);

    return Promise.resolve({ ...unsignedTx, feeLimit, feePricePerUnit });
  }

  getBalances(
    requests: { address: string }[],
  ): Promise<(BigNumber | undefined)[]> {
    return this.blockbook.then((client) =>
      Promise.all(requests.map(({ address }) => client.getBalance(address))),
    );
  }

  getBalancesByAddress(
    requests: { address: string }[],
  ): Promise<(BigNumber | undefined)[]> {
    return this.blockbook.then((client) =>
      Promise.all(
        requests.map(({ address }) => client.getBalanceWithAddress(address)),
      ),
    );
  }

  async getUTXOs(xpub: string, options: ICollectUTXOsOptions = {}) {
    return this.blockbook.then((client) => client.getUTXOs(xpub, options));
  }

  getPsbt() {
    return new BitcoinJS.Psbt({ network: this.network });
  }

  async getBitcoinSigner(
    signer: Signer,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    input: PsbtInput,
  ): Promise<BitcoinJS.Signer> {
    const publicKey = await signer.getPubkey(true);
    return {
      publicKey,
      // @ts-expect-error
      sign: async (hash: Buffer) => {
        const [sig] = await signer.sign(hash);
        return sig;
      },
    };
  }

  async signTransaction(
    unsignedTx: IUnsignedTxPro,
    signers: { [p: string]: Signer },
  ): Promise<SignedTx> {
    const psbt = await this.packTransaction(unsignedTx, signers);

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < unsignedTx.inputs.length; ++i) {
      const { address } = unsignedTx.inputs[i];
      const signer = signers[address];
      const psbtInput = psbt.data.inputs[0];
      const bitcoinSigner = await this.getBitcoinSigner(signer, psbtInput);
      await psbt.signInputAsync(i, bitcoinSigner);
    }

    psbt.validateSignaturesOfAllInputs(validator);
    psbt.finalizeAllInputs();

    const tx = psbt.extractTransaction();
    return {
      txid: tx.getId(),
      rawTx: tx.toHex(),
    };
  }

  async signPsbt({
    psbt,
    signers,
    inputsToSign,
  }: {
    psbt: BitcoinJS.Psbt;
    signers: { [p: string]: Signer };
    inputsToSign: InputToSign[];
  }) {
    for (let i = 0, len = inputsToSign.length; i < len; i += 1) {
      const input = inputsToSign[i];
      const signer = signers[input.address];
      const bitcoinSigner = await this.getBitcoinSigner(
        signer,
        psbt.data.inputs[input.index],
      );
      await psbt.signInputAsync(input.index, bitcoinSigner, input.sighashTypes);
    }
    return {
      txid: '',
      rawTx: '',
      psbtHex: psbt.toHex(),
    };
  }

  private async packTransaction(
    unsignedTx: IUnsignedTxPro,
    signers: { [p: string]: Signer },
  ) {
    const { inputs, outputs } = unsignedTx;

    const [inputAddressesEncodings, nonWitnessPrevTxs] =
      await this.collectInfoForSoftwareSign(unsignedTx);

    const psbt = this.getPsbt();

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < inputs.length; ++i) {
      const input = inputs[i];
      const utxo = input.utxo as UTXO;
      check(utxo);

      const encoding = inputAddressesEncodings[i];
      const mixin: TransactionMixin = {};

      switch (encoding) {
        case AddressEncodings.P2PKH:
          mixin.nonWitnessUtxo = Buffer.from(
            nonWitnessPrevTxs[utxo.txid],
            'hex',
          );
          break;
        case AddressEncodings.P2WPKH:
          mixin.witnessUtxo = {
            script: checkIsDefined(
              this.pubkeyToPayment(
                await signers[input.address].getPubkey(true),
                encoding,
              ),
            ).output as Buffer,
            value: utxo.value.integerValue().toNumber(),
          };
          break;
        case AddressEncodings.P2SH_P2WPKH:
          {
            const payment = checkIsDefined(
              this.pubkeyToPayment(
                await signers[input.address].getPubkey(true),
                encoding,
              ),
            );
            mixin.witnessUtxo = {
              script: payment.output as Buffer,
              value: utxo.value.integerValue().toNumber(),
            };
            mixin.redeemScript = payment.redeem?.output as Buffer;
          }
          break;
        case AddressEncodings.P2TR:
          {
            const payment = checkIsDefined(
              this.pubkeyToPayment(
                await signers[input.address].getPubkey(true),
                encoding,
              ),
            );
            mixin.witnessUtxo = {
              script: payment.output as Buffer,
              value: utxo.value.integerValue().toNumber(),
            };
            mixin.tapInternalKey = payment.internalPubkey;
          }
          break;
        default:
          break;
      }

      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        ...mixin,
      });
    }

    outputs.forEach((output) => {
      const { payload } = output;
      if (
        payload?.opReturn &&
        typeof payload?.opReturn === 'string' &&
        payload?.opReturn.length > 0
      ) {
        const embed = BitcoinJS.payments.embed({
          data: [loadOPReturn(payload?.opReturn)],
        });
        psbt.addOutput({
          script: checkIsDefined(embed.output),
          value: 0,
        });
      } else {
        psbt.addOutput({
          address: output.address,
          value: output.value.integerValue().toNumber(),
        });
      }
    });

    return psbt;
  }

  private async collectInfoForSoftwareSign(
    unsignedTx: IUnsignedTxPro,
  ): Promise<[string[], Record<string, string>]> {
    const { inputs } = unsignedTx;

    const inputAddressesEncodings = await this.parseAddressEncodings(
      inputs.map((i) => i.address),
    );
    check(
      inputAddressesEncodings.length === inputs.length,
      'Found invalid address from inputs',
    );

    const nonWitnessInputPrevTxids = Array.from(
      new Set(
        inputAddressesEncodings
          .map((encoding, index) => {
            if (encoding === AddressEncodings.P2PKH) {
              return checkIsDefined(inputs[index].utxo).txid;
            }
            return undefined;
          })
          .filter((i) => !!i) as string[],
      ),
    );

    const nonWitnessPrevTxs = await this.collectTxs(nonWitnessInputPrevTxids);

    return [inputAddressesEncodings, nonWitnessPrevTxs];
  }

  async collectTxs(txids: string[]): Promise<Record<string, string>> {
    const blockbook = await this.blockbook;
    const lookup: Record<string, string> = {};

    for (let i = 0, batchSize = 5; i < txids.length; i += batchSize) {
      const batchTxids = txids.slice(i, i + batchSize);
      const txs = await Promise.all(
        batchTxids.map((txid) => blockbook.getRawTransaction(txid)),
      );
      batchTxids.forEach((txid, index) => (lookup[txid] = txs[index]));
    }
    return lookup;
  }

  broadcastTransaction(rawTx: string) {
    return this.blockbook.then((client) => client.broadcastTransaction(rawTx));
  }

  getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    return this.blockbook.then((client) =>
      client.getTransactionStatuses(txids),
    );
  }

  signMessage({
    password,
    entropy,
    path,
    message,
    keyPair: keyPairFromOut,
    sigOptions = { segwitType: 'p2wpkh' },
  }: {
    password: string;
    entropy: Buffer;
    path: string;
    message: string;
    keyPair?: ECPairInterface;
    sigOptions?: SignatureOptions | null;
  }) {
    initBitcoinEcc();

    let keyPair;
    if (keyPairFromOut) {
      keyPair = keyPairFromOut;
    } else {
      const mnemonic = mnemonicFromEntropy(entropy, password);
      const seed = mnemonicToSeedSync(mnemonic);
      const root = getBitcoinBip32().fromSeed(seed);
      const node = root.derivePath(path);
      keyPair = getBitcoinECPair().fromWIF(node.toWIF());
    }

    const signature = bitcoinMessage.sign(
      message,
      // @ts-expect-error
      keyPair.privateKey,
      keyPair.compressed,
      sigOptions,
    );
    return signature;
  }

  async signBip322MessageSimple({
    account,
    message,
    signers,
    psbtNetwork,
  }: {
    account: Account;
    message: string;
    signers: Record<string, Signer>;
    psbtNetwork: BitcoinJS.networks.Network;
  }) {
    initBitcoinEcc();
    const outputScript = BitcoinJS.address.toOutputScript(
      account.address,
      psbtNetwork,
    );

    const prevoutHash = Buffer.from(
      '0000000000000000000000000000000000000000000000000000000000000000',
      'hex',
    );
    const prevoutIndex = 0xffffffff;
    const sequence = 0;
    const scriptSig = Buffer.concat([
      Buffer.from('0020', 'hex'),
      Buffer.from(bip0322Hash(message), 'hex'),
    ]);

    const txToSpend = new BitcoinJS.Transaction();
    txToSpend.version = 0;
    txToSpend.addInput(prevoutHash, prevoutIndex, sequence, scriptSig);
    txToSpend.addOutput(outputScript, 0);

    const psbtToSign = new BitcoinJS.Psbt();
    psbtToSign.setVersion(0);
    psbtToSign.addInput({
      hash: txToSpend.getHash(),
      index: 0,
      sequence: 0,
      witnessUtxo: {
        script: outputScript,
        value: 0,
      },
    });
    psbtToSign.addOutput({ script: Buffer.from('6a', 'hex'), value: 0 });

    const inputsToSign = getInputsToSignFromPsbt({
      psbt: psbtToSign,
      psbtNetwork,
      account,
    });

    await this.signPsbt({
      psbt: psbtToSign,
      signers,
      inputsToSign,
    });

    inputsToSign.forEach((v) => {
      psbtToSign.finalizeInput(v.index);
    });

    const txToSign = psbtToSign.extractTransaction();

    const len = encode(txToSign.ins[0].witness.length);
    const signature = Buffer.concat([
      len,
      ...txToSign.ins[0].witness.map((w) => encodeVarString(w)),
    ]);

    return signature;
  }

  verifyMessage({
    message,
    address,
    signature,
  }: {
    message: string;
    address: string;
    signature: string;
  }) {
    return bitcoinMessage.verify(
      message,
      address,
      Buffer.from(signature, 'hex'),
    );
  }

  getTransactionDetail(txId: string) {
    return this.blockbook.then((client) => client.getTransactionDetail(txId));
  }
}

export { Provider };
