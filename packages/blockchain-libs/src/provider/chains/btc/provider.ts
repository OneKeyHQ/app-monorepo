import OneKeyConnect from '@onekeyfe/js-sdk';
// @ts-ignore
import * as pathUtils from '@onekeyfe/js-sdk/lib/utils/pathUtils';
import BigNumber from 'bignumber.js';
import * as BitcoinJS from 'bitcoinjs-lib';
import bitcoinMessage from 'bitcoinjs-message';
import bs58check from 'bs58check';

import { BaseProvider } from '@onekeyhq/engine/src/client/BaseClient';
import { CKDPub, compressPublicKey, verify } from '@onekeyhq/engine/src/secret';
import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import type {
  AddressValidation,
  SignedTx,
  TxInput,
  TxOutput,
  TypedMessage,
  UTXO,
  UnsignedTx,
} from '@onekeyhq/engine/src/types/provider';
import type { Signer, Verifier } from '@onekeyhq/engine/src/types/secret';
import { check, checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { BlockBook } from './blockbook';
import AddressEncodings from './sdk/addressEncodings';
import { getNetwork } from './sdk/networks';
import { PLACEHOLDER_VSIZE, estimateVsize, loadOPReturn } from './sdk/vsize';

import type { Network } from './sdk/networks';
import type {
  RefTransaction,
  TxInputType,
  TxOutputType,
} from '@onekeyfe/js-sdk';
import type {
  NonWitnessUtxo,
  RedeemScript,
  WitnessUtxo,
} from 'bip174/src/lib/interfaces';

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

const validator = (
  pubkey: Buffer,
  msghash: Buffer,
  signature: Buffer,
): boolean => verify('secp256k1', pubkey, msghash, signature);

class Provider extends BaseProvider {
  private _versionBytesToEncodings?: {
    public: Record<number, Array<AddressEncodings>>;
    private: Record<number, Array<AddressEncodings>>;
  };

  get network(): Network {
    return getNetwork(this.chainInfo.code);
  }

  get blockbook(): Promise<BlockBook> {
    return this.clientSelector((client) => client instanceof BlockBook);
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

  isValidXpub(xpub: string | Buffer): boolean {
    return this.isValidExtendedKey(xpub, 'pub');
  }

  isValidXprv(xprv: string | Buffer): boolean {
    return this.isValidExtendedKey(xprv, 'prv');
  }

  xprvToXpub(xprv: string): string {
    const decodedXprv = bs58check.decode(xprv);
    check(this.isValidXprv(decodedXprv));
    const privateKey = decodedXprv.slice(46, 78);
    const publicKey = compressPublicKey(
      'secp256k1',
      secp256k1.publicFromPrivate(privateKey),
    );
    return bs58check.encode(
      Buffer.concat([decodedXprv.slice(0, 45), publicKey]),
    );
  }

  getAccount(
    params: GetAccountParams,
    addressEncoding?: AddressEncodings,
  ): Promise<any> {
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

  async pubkeyToAddress(
    verifier: Verifier,
    encoding: AddressEncodings,
  ): Promise<string> {
    const pubkey = await verifier.getPubkey(true);
    console.log('pub', pubkey.toString('hex'), encoding);
    const payment = this.pubkeyToPayment(pubkey, encoding);

    const { address } = payment;
    check(typeof address === 'string' && address);
    return address as string;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyAddress(address: string): Promise<AddressValidation> {
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
        // Cannot distinguish between legacy P2SH and P2SH_P2WPKH
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
        // eslint-disable-next-line @typescript-eslint/no-shadow
      } catch (e) {
        // ignored
      }
    }

    return encoding
      ? {
          displayAddress: address,
          normalizedAddress: address,
          encoding,
          isValid: true,
        }
      : { isValid: false };
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
    feePricePerUnit =
      feePricePerUnit ||
      (await this.blockbook
        .then((client) => client.getFeePricePerUnit())
        .then((fee) => fee.normal.price));

    return { ...unsignedTx, feeLimit, feePricePerUnit };
  }

  async signTransaction(
    unsignedTx: UnsignedTx,
    signers: { [p: string]: Signer },
  ): Promise<SignedTx> {
    const psdt = await this.packTransaction(unsignedTx, signers);

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < unsignedTx.inputs.length; ++i) {
      const { address } = unsignedTx.inputs[i];
      const signer = signers[address];
      const publicKey = await signer.getPubkey(true);

      await psdt.signInputAsync(i, {
        publicKey,
        sign: async (hash: Buffer) => {
          const [sig] = await signer.sign(hash);
          return sig;
        },
      });
    }
    psdt.validateSignaturesOfAllInputs(validator);
    psdt.finalizeAllInputs();

    const tx = psdt.extractTransaction();
    return {
      txid: tx.getId(),
      rawTx: tx.toHex(),
    };
  }

  override signMessage = async (
    { message }: TypedMessage,
    signer: Signer,
    address?: string,
  ): Promise<string> => {
    check(address, '"Address" required');
    const validation = await this.verifyAddress(address as string);
    check(validation.isValid, 'Invalid Address');

    let signOptions: Record<string, unknown> | undefined;
    if (validation.encoding === AddressEncodings.P2WPKH) {
      signOptions = { segwitType: 'p2wpkh' };
    } else if (validation.encoding === AddressEncodings.P2SH_P2WPKH) {
      signOptions = { segwitType: 'p2sh(p2wpkh)' };
    }

    const sig = await bitcoinMessage.signAsync(
      message,
      {
        sign: async (digest: Uint8Array) => {
          const [signature, recovery] = await signer.sign(Buffer.from(digest));
          return { signature, recovery };
        },
      },
      true,
      this.network.messagePrefix,
      signOptions,
    );
    return sig.toString('base64');
  };

  override verifyMessage = async (
    address: string,
    { message }: TypedMessage,
    signature: string,
  ): Promise<boolean> => {
    const validation = await this.verifyAddress(address);
    check(validation.isValid, 'Invalid Address');

    const checkSegwitAlways =
      validation.encoding === AddressEncodings.P2WPKH ||
      validation.encoding === AddressEncodings.P2SH_P2WPKH;

    return bitcoinMessage.verify(
      message,
      address,
      signature,
      this.network.messagePrefix,
      checkSegwitAlways,
    );
  };

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
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Invalid encoding: ${encoding}`);
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

  private async packTransaction(
    unsignedTx: UnsignedTx,
    signers: { [p: string]: Signer },
  ): Promise<BitcoinJS.Psbt> {
    const {
      inputs,
      outputs,
      payload: { opReturn },
    } = unsignedTx;

    const [inputAddressesEncodings, nonWitnessPrevTxs] =
      await this.collectInfoForSoftwareSign(unsignedTx);

    const psbt = new BitcoinJS.Psbt({ network: this.network });

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < inputs.length; ++i) {
      const input = inputs[i];
      const utxo = input.utxo as UTXO;
      check(utxo);

      const encoding = inputAddressesEncodings[i];
      const mixin: {
        nonWitnessUtxo?: NonWitnessUtxo;
        witnessUtxo?: WitnessUtxo;
        redeemScript?: RedeemScript;
      } = {};

      // eslint-disable-next-line default-case
      switch (encoding) {
        case AddressEncodings.P2PKH:
          mixin.nonWitnessUtxo = Buffer.from(nonWitnessPrevTxs[utxo.txid]);
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
      }

      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        ...mixin,
      });
    }

    outputs.forEach((output) => {
      psbt.addOutput({
        address: output.address,
        value: output.value.integerValue().toNumber(),
      });
    });

    if (typeof opReturn === 'string') {
      const embed = BitcoinJS.payments.embed({
        data: [loadOPReturn(opReturn)],
      });
      psbt.addOutput({
        script: checkIsDefined(embed.output),
        value: 0,
      });
    }

    return psbt;
  }

  private async collectInfoForSoftwareSign(
    unsignedTx: UnsignedTx,
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
          // eslint-disable-next-line array-callback-return
          .map((encoding, index) => {
            if (encoding === AddressEncodings.P2PKH) {
              return checkIsDefined(inputs[index].utxo).txid;
            }
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

  get hardwareCoinName(): string {
    const name = this.chainInfo.implOptions?.hardwareCoinName;
    check(
      typeof name === 'string' && name,
      `Please config hardwareCoinName for ${this.chainInfo.code}`,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return name;
  }

  override hardwareGetXpubs = async (
    paths: string[],
    showOnDevice: boolean,
  ): Promise<{ path: string; xpub: string }[]> => {
    const resp = await this.wrapHardwareCall(() =>
      OneKeyConnect.getPublicKey({
        bundle: paths.map((path) => ({
          path,
          coin: this.hardwareCoinName,
          showOnTrezor: showOnDevice,
        })),
      }),
    );

    return resp.map((i) => ({
      path: i.serializedPath,
      xpub: i.xpub,
    }));
  };

  override hardwareGetAddress = async (
    path: string,
    showOnDevice: boolean,
    addressToVerify?: string,
  ): Promise<string> => {
    const params = {
      path,
      coin: this.hardwareCoinName,
      showOnTrezor: showOnDevice,
    };

    // eslint-disable-next-line no-unused-expressions,@typescript-eslint/no-unused-expressions
    typeof addressToVerify === 'string' &&
      Object.assign(params, { address: addressToVerify });

    const { address } = await this.wrapHardwareCall(() =>
      OneKeyConnect.getAddress(params),
    );
    return address;
  };

  override hardwareSignTransaction = async (
    unsignedTx: UnsignedTx,
    signers: Record<string, string>,
  ): Promise<SignedTx> => {
    const { inputs, outputs } = unsignedTx;
    const prevTxids = Array.from(
      new Set(inputs.map((i) => (i.utxo as UTXO).txid)),
    );
    const prevTxs = await this.collectTxs(prevTxids);

    const { serializedTx } = await this.wrapHardwareCall(() =>
      OneKeyConnect.signTransaction({
        useEmptyPassphrase: true,
        coin: this.hardwareCoinName,
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        inputs: inputs.map((i) => buildHardwareInput(i, signers[i.address])),
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        outputs: outputs.map((o) => buildHardwareOutput(o)),
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        refTxs: Object.values(prevTxs).map((i) => buildPrevTx(i)),
      }),
    );

    const tx = BitcoinJS.Transaction.fromHex(serializedTx);

    return { txid: tx.getId(), rawTx: serializedTx };
  };

  override hardwareSignMessage = async (
    { message }: TypedMessage,
    signer: string,
  ): Promise<string> => {
    const { signature } = await this.wrapHardwareCall(() =>
      OneKeyConnect.signMessage({
        path: signer,
        message,
        coin: this.hardwareCoinName,
      }),
    );
    return signature as string;
  };

  override hardwareVerifyMessage = async (
    address: string,
    { message }: TypedMessage,
    signature: string,
  ): Promise<boolean> => {
    const { message: resp } = await this.wrapHardwareCall(() =>
      OneKeyConnect.verifyMessage({
        address,
        signature,
        message,
        coin: this.hardwareCoinName,
      }),
    );

    return resp === 'Message verified';
  };
}

const buildPrevTx = (rawTx: string): RefTransaction => {
  const tx = BitcoinJS.Transaction.fromHex(rawTx);

  return {
    hash: tx.getId(),
    version: tx.version,
    inputs: tx.ins.map((i) => ({
      prev_hash: i.hash.reverse().toString('hex'),
      prev_index: i.index,
      script_sig: i.script.toString('hex'),
      sequence: i.sequence,
    })),
    bin_outputs: tx.outs.map((o) => ({
      amount: o.value,
      script_pubkey: o.script.toString('hex'),
    })),
    lock_time: tx.locktime,
  };
};

const buildHardwareInput = (input: TxInput, path: string): TxInputType => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  const addressN = pathUtils.getHDPath(path);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  const scriptType = pathUtils.getScriptType(addressN);
  const utxo = input.utxo as UTXO;
  check(utxo);

  return {
    prev_index: utxo.vout,
    prev_hash: utxo.txid,
    amount: utxo.value.integerValue().toString(),
    address_n: addressN,
    script_type: scriptType,
  };
};

const buildHardwareOutput = (output: TxOutput): TxOutputType => {
  const { isCharge, bip44Path } = output.payload || {};

  if (isCharge && bip44Path) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const addressN = pathUtils.getHDPath(bip44Path);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const scriptType = pathUtils.getScriptType(addressN);
    return {
      script_type: scriptType,
      address_n: addressN,
      amount: output.value.integerValue().toString(),
    };
  }

  return {
    script_type: 'PAYTOADDRESS',
    address: output.address,
    amount: output.value.integerValue().toString(),
  };
};

export { Provider };
