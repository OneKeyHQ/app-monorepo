import { mnemonicToSeedSync } from 'bip39';
import {
  address as BitcoinJsAddress,
  crypto as BitcoinJsCrypto,
  Transaction as BitcoinJsTransaction,
  Psbt,
  payments,
} from 'bitcoinjs-lib';
import bitcoinMessage from 'bitcoinjs-message';
import bs58check from 'bs58check';
import { omit } from 'lodash';
import { encode as VaruintBitCoinEncode } from 'varuint-bitcoin';

import { IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { check, checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import {
  CKDPub,
  batchGetPublicKeys,
  generateRootFingerprint,
  mnemonicFromEntropy,
  verify,
} from '../../secret';
import { BaseBip32KeyDeriver } from '../../secret/bip32';
import { secp256k1 } from '../../secret/curves';
import { decrypt, encrypt } from '../../secret/encryptors/aes256';
import {
  EAddressEncodings,
  EMessageTypesBtc,
  type ICoreApiGetAddressItem,
  type ICoreApiGetAddressQueryImportedBtc,
  type ICoreApiGetAddressQueryPublicKey,
  type ICoreApiGetAddressesQueryHdBtc,
  type ICoreApiGetAddressesResult,
  type ICoreApiPrivateKeysMap,
  type ICoreApiSignAccount,
  type ICoreApiSignBasePayload,
  type ICoreApiSignMsgPayload,
  type ICoreApiSignTxPayload,
  type ICurveName,
  type ISignedTxPro,
  type IUnsignedMessageBtc,
  type InputToSign,
} from '../../types';
import { slicePathTemplate } from '../../utils';

import {
  getBitcoinBip32,
  getBitcoinECPair,
  getBtcForkNetwork,
  getInputsToSignFromPsbt,
  initBitcoinEcc,
  isTaprootPath,
  loadOPReturn,
  tweakSigner,
} from './sdkBtc';

import type {
  IBtcForkNetwork,
  IBtcForkTransactionMixin,
  IBtcForkUTXO,
} from './types';
import type { ISigner } from '../../base/ChainSigner';
import type { Bip32KeyDeriver, ExtendedKey } from '../../secret/bip32';
import type { PsbtInput } from 'bip174/src/lib/interfaces';
import type { Payment, Signer, networks } from 'bitcoinjs-lib';

const curveName: ICurveName = 'secp256k1';
// const a  = tweakSigner()

const validator = (
  pubkey: Buffer,
  msghash: Buffer,
  signature: Buffer,
): boolean => verify(curveName, pubkey, msghash, signature);

const bip0322Hash = (message: string) => {
  const { sha256 } = BitcoinJsCrypto;
  const tag = 'BIP0322-signed-message';
  const tagHash = sha256(Buffer.from(tag));
  const result = sha256(
    Buffer.concat([tagHash, tagHash, Buffer.from(message)]),
  );
  return result.toString('hex');
};

const encodeVarString = (buffer: Buffer) =>
  Buffer.concat([VaruintBitCoinEncode(buffer.byteLength), buffer]);

export default class CoreChainSoftware extends CoreChainApiBase {
  protected decodeAddress(address: string): string {
    return address;
  }

  protected encodeAddress(address: string): string {
    return address;
  }

  protected getPsbt({ network }: { network: IBtcForkNetwork }): Psbt {
    return new Psbt({ network });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { networkInfo, publicKey, publicKeyInfo } = query;
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    // 'BTC fork UTXO account should pass account xpub but not single address publicKey.',
    const xpub = publicKey;

    const result = this.getAddressFromXpub({
      network,
      xpub,
      relativePaths: ['0/0'],
    });
    return {
      address: result['0/0'],
      publicKey: '',
      xpub,
      addresses: result,
    };
  }

  // TODO memo and move to utils (file with getBtcForkNetwork)
  private getVersionBytesToEncodings({
    networkChainCode,
  }: {
    networkChainCode: string | undefined;
  }): {
    public: Record<number, Array<EAddressEncodings>>;
    private: Record<number, Array<EAddressEncodings>>;
  } {
    const network = getBtcForkNetwork(networkChainCode);
    const tmp: {
      public: {
        [bytes: number]: EAddressEncodings[];
      };
      private: {
        [bytes: number]: EAddressEncodings[];
      };
    } = {
      public: { [network.bip32.public]: [EAddressEncodings.P2PKH] },
      private: { [network.bip32.private]: [EAddressEncodings.P2PKH] },
    };
    Object.entries(network.segwitVersionBytes || {}).forEach(
      ([
        encoding,
        { public: publicVersionBytes, private: privateVersionBytes },
      ]) => {
        tmp.public[publicVersionBytes] = [
          ...(tmp.public[publicVersionBytes] || []),
          encoding as EAddressEncodings,
        ];
        tmp.private[privateVersionBytes] = [
          ...(tmp.private[privateVersionBytes] || []),
          encoding as EAddressEncodings,
        ];
      },
    );
    return tmp;
  }

  private pubkeyToPayment({
    pubkey,
    encoding,
    network,
  }: {
    pubkey: Buffer;
    encoding: EAddressEncodings;
    network: IBtcForkNetwork;
  }): Payment {
    initBitcoinEcc();
    let payment: Payment = {
      pubkey,
      network,
    };

    switch (encoding) {
      case EAddressEncodings.P2PKH:
        payment = payments.p2pkh(payment);
        break;

      case EAddressEncodings.P2WPKH:
        payment = payments.p2wpkh(payment);
        break;

      case EAddressEncodings.P2SH_P2WPKH:
        payment = payments.p2sh({
          redeem: payments.p2wpkh(payment),
          network,
        });
        break;
      case EAddressEncodings.P2TR:
        payment = payments.p2tr({
          internalPubkey: pubkey.slice(1, 33),
          network,
        });
        break;

      default:
        throw new Error(`Invalid encoding: ${encoding as string}`);
    }

    return payment;
  }

  public getAddressFromXpub({
    network,
    xpub,
    relativePaths,
    addressEncoding,
  }: {
    network: IBtcForkNetwork;
    xpub: string;
    relativePaths: Array<string>;
    addressEncoding?: EAddressEncodings;
  }): Record<string, string> {
    // Only used to generate addresses locally.
    const decodedXpub = bs58check.decode(xpub);
    const versionBytes = parseInt(
      bufferUtils.bytesToHex(decodedXpub.slice(0, 4)),
      16,
    );
    const encoding =
      addressEncoding ??
      this.getVersionBytesToEncodings({
        networkChainCode: network.networkChainCode,
      }).public[versionBytes][0];

    const ret: Record<string, string> = {};

    const startExtendedKey: ExtendedKey = {
      chainCode: bufferUtils.toBuffer(decodedXpub.slice(13, 45)),
      key: bufferUtils.toBuffer(decodedXpub.slice(45, 78)),
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
        extendedKey = CKDPub(curveName, extendedKey, index);
        cache.set(relPath, extendedKey);
      }

      // const pubkey = taproot && inscribe ? fixedPublickey : extendedKey.key;
      let { address } = this.pubkeyToPayment({
        network,
        pubkey: extendedKey.key,
        encoding,
      });
      if (typeof address === 'string' && address.length > 0) {
        address = this.encodeAddress(address);
        ret[path] = address;
      }
    }
    return ret;
  }

  private async buildSignersMap({
    payload,
  }: {
    payload: ICoreApiSignBasePayload;
  }): Promise<Partial<{ [address: string]: ISigner }>> {
    const { password } = payload;
    const privateKeys = await this.getPrivateKeysInFullPath({
      payload,
    });
    const pathToAddresses = payload?.btcExtraInfo?.pathToAddresses;
    const signers: { [address: string]: ISigner } = {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [fullPath, privateKey] of Object.entries(privateKeys)) {
      const address = pathToAddresses?.[fullPath]?.address;
      if (!address) {
        throw new Error(
          'getSignersMap ERROR: address is required, is privateKeys including fullPath?',
        );
      }
      signers[address] = await this.buildSignerBtc({
        privateKey,
        password,
      });
    }
    return signers;
  }

  private buildSignerBtc({
    privateKey,
    password,
  }: {
    privateKey: string; // encryptedPrivateKey by password
    password: string;
  }) {
    return this.baseCreateSigner({
      curve: curveName,
      privateKey,
      password,
    });
  }

  private async getBitcoinSignerPro({
    network,
    signer,
    input,
  }: {
    network: IBtcForkNetwork;
    signer: ISigner;
    input: PsbtInput;
  }): Promise<Signer> {
    const publicKey = await signer.getPubkey(true);

    // P2TR taproot
    if (input && input.tapInternalKey) {
      const privateKey = await signer.getPrvkey();
      const tweakedSigner = tweakSigner(privateKey, publicKey, {
        network,
      });

      return tweakedSigner;
    }

    // For other encoding (other btc fork chain)
    return {
      publicKey,
      // @ts-expect-error
      sign: async (hash: Buffer) => {
        const [sig] = await signer.sign(hash);
        return sig;
      },
    };
  }

  private async packTransaction({
    network,
    signers,
    payload,
  }: {
    network: IBtcForkNetwork;
    signers: Partial<{ [address: string]: ISigner }>;
    payload: ICoreApiSignTxPayload;
  }) {
    const { unsignedTx, btcExtraInfo } = payload;
    const {
      inputs,
      outputs,
      payload: { opReturn },
    } = unsignedTx;

    const inputAddressesEncodings = checkIsDefined(
      btcExtraInfo?.inputAddressesEncodings,
    );
    const nonWitnessPrevTxs = checkIsDefined(btcExtraInfo?.nonWitnessPrevTxs);

    const psbt = this.getPsbt({ network });

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < inputs.length; ++i) {
      const input = inputs[i];
      const utxo = input.utxo as IBtcForkUTXO;
      check(utxo);

      const encoding = inputAddressesEncodings[i];
      const mixin: IBtcForkTransactionMixin = {};

      const signer = this.pickSigner(signers, input.address);

      switch (encoding) {
        case EAddressEncodings.P2PKH:
          mixin.nonWitnessUtxo = Buffer.from(
            nonWitnessPrevTxs[utxo.txid],
            'hex',
          );
          break;
        case EAddressEncodings.P2WPKH:
          mixin.witnessUtxo = {
            script: checkIsDefined(
              this.pubkeyToPayment({
                pubkey: await signer.getPubkey(true),
                encoding,
                network,
              }),
            ).output as Buffer,
            value: utxo.value.integerValue().toNumber(),
          };
          break;
        case EAddressEncodings.P2SH_P2WPKH:
          {
            const payment = checkIsDefined(
              this.pubkeyToPayment({
                pubkey: await signer.getPubkey(true),
                encoding,
                network,
              }),
            );
            mixin.witnessUtxo = {
              script: payment.output as Buffer,
              value: utxo.value.integerValue().toNumber(),
            };
            mixin.redeemScript = payment.redeem?.output as Buffer;
          }
          break;
        case EAddressEncodings.P2TR:
          {
            const payment = checkIsDefined(
              this.pubkeyToPayment({
                pubkey: await signer.getPubkey(true),
                encoding,
                network,
              }),
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
      psbt.addOutput({
        address: output.address,
        value: output.value.integerValue().toNumber(),
      });
    });

    if (typeof opReturn === 'string') {
      const embed = payments.embed({
        data: [loadOPReturn(opReturn)],
      });
      psbt.addOutput({
        script: checkIsDefined(embed.output),
        value: 0,
      });
    }

    return psbt;
  }

  private appendImportedRelPathPrivateKeys({
    privateKeys,
    password,
    relPaths,
  }: {
    privateKeys: ICoreApiPrivateKeysMap;
    password: string;
    relPaths?: string[];
  }): ICoreApiPrivateKeysMap {
    const deriver = new BaseBip32KeyDeriver(
      Buffer.from('Bitcoin seed'),
      secp256k1,
    ) as Bip32KeyDeriver;

    // imported account return "" key as root privateKey
    const privateKey = privateKeys[''];
    const xprv = decrypt(password, bufferUtils.toBuffer(privateKey));
    const startKey = {
      chainCode: xprv.slice(13, 45),
      key: xprv.slice(46, 78),
    };

    const cache: Record<string, ExtendedKey> = {};

    relPaths?.forEach((relPath) => {
      const pathComponents = relPath.split('/');

      let currentPath = '';
      let parent = startKey;
      pathComponents.forEach((pathComponent) => {
        currentPath =
          currentPath.length > 0
            ? `${currentPath}/${pathComponent}`
            : pathComponent;
        if (typeof cache[currentPath] === 'undefined') {
          const index = pathComponent.endsWith("'")
            ? parseInt(pathComponent.slice(0, -1)) + 2 ** 31
            : parseInt(pathComponent);
          const thisPrivKey = deriver.CKDPriv(parent, index);
          cache[currentPath] = thisPrivKey;
        }
        parent = cache[currentPath];
      });

      // TODO use dbAccountAddresses save fullPath/relPath key
      privateKeys[relPath] = bufferUtils.bytesToHex(
        encrypt(password, cache[relPath].key),
      );
    });
    return privateKeys;
  }

  async getPrivateKeysInFullPath({
    payload,
  }: {
    payload: ICoreApiSignBasePayload;
  }): Promise<ICoreApiPrivateKeysMap> {
    const btcExtraInfo = checkIsDefined(payload.btcExtraInfo);
    // privateKeys in relPaths
    const privateKeys = await this.getPrivateKeys(payload);

    const isImported = !!payload.credentials.imported;

    const { pathToAddresses } = btcExtraInfo;
    const networkImpl = checkIsDefined(payload.networkInfo.networkImpl);

    const ret: ICoreApiPrivateKeysMap = {};

    for (const [fullPath, { address, relPath }] of Object.entries(
      pathToAddresses,
    )) {
      const privateKeyPath = isImported ? relPath : fullPath;
      let privateKey = privateKeys[privateKeyPath];

      // fix blockbook utxo path to match local account path
      if (networkImpl === IMPL_TBTC) {
        if (!privateKey) {
          const fixedPath = privateKeyPath.replace(`m/86'/0'/`, `m/86'/1'/`);
          privateKey = privateKeys[fixedPath];
        }
        if (!privateKey) {
          const fixedPath = privateKeyPath.replace(`m/86'/1'/`, `m/86'/0'/`);
          privateKey = privateKeys[fixedPath];
        }
      }

      // TODO generate address from privateKey, and check if matched with utxo address
      const addressFromPrivateKey = address;
      if (addressFromPrivateKey !== address) {
        throw new Error('addressFromPrivateKey and utxoAddress not matched');
      }

      if (!privateKey) {
        throw new Error(`privateKey not found: ${address} ${fullPath}`);
      }

      ret[fullPath] = privateKey;
    }

    return ret;
  }

  async signBip322MessageSimple({
    account,
    message,
    signers,
    psbtNetwork,
  }: {
    account: ICoreApiSignAccount;
    message: string;
    signers: Partial<{ [address: string]: ISigner }>;
    psbtNetwork: networks.Network;
  }) {
    initBitcoinEcc();
    const outputScript = BitcoinJsAddress.toOutputScript(
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

    const txToSpend = new BitcoinJsTransaction();
    txToSpend.version = 0;
    txToSpend.addInput(prevoutHash, prevoutIndex, sequence, scriptSig);
    txToSpend.addOutput(outputScript, 0);

    const psbtToSign = new Psbt();
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
      network: psbtNetwork,
    });

    inputsToSign.forEach((v) => {
      psbtToSign.finalizeInput(v.index);
    });

    const txToSign = psbtToSign.extractTransaction();

    const len = VaruintBitCoinEncode(txToSign.ins[0].witness.length);
    const signature = Buffer.concat([
      len,
      ...txToSign.ins[0].witness.map((w) => encodeVarString(w)),
    ]);

    return signature;
  }

  async signPsbt({
    network,
    psbt,
    signers,
    inputsToSign,
  }: {
    network: IBtcForkNetwork;
    psbt: Psbt;
    signers: Partial<{ [address: string]: ISigner }>;
    inputsToSign: InputToSign[];
  }) {
    for (let i = 0, len = inputsToSign.length; i < len; i += 1) {
      const input = inputsToSign[i];
      const signer = this.pickSigner(signers, input.address);
      const bitcoinSigner = await this.getBitcoinSignerPro({
        network,
        signer,
        input: psbt.data.inputs[input.index],
      });
      psbt.signInput(input.index, bitcoinSigner, input.sighashTypes);
    }
    return {
      txid: '',
      rawTx: '',
      psbtHex: psbt.toHex(),
    };
  }

  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    const { password, account } = payload;
    const isImported = !!payload.credentials.imported;
    const privateKeys = await this.baseGetPrivateKeys({
      payload,
      curve: curveName,
    });
    if (isImported) {
      const { relPaths } = account;
      this.appendImportedRelPathPrivateKeys({
        privateKeys,
        password,
        relPaths,
      });
    }
    return privateKeys;
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImportedBtc,
  ): Promise<ICoreApiGetAddressItem> {
    const {
      privateKeyRaw,
      networkInfo: { networkChainCode },
      template,
    } = query;
    // xPrivateKey but not single address privateKey
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);

    let xpub = '';
    let pubKey = '';
    const network = getBtcForkNetwork(networkChainCode);

    const xprvVersionBytesNum = parseInt(
      privateKey.slice(0, 4).toString('hex'),
      16,
    );
    const versionByteOptions = [
      // ...Object.values(network.segwitVersionBytes || {}),
      ...Object.values(
        omit(network.segwitVersionBytes, EAddressEncodings.P2TR),
      ),
      network.bip32,
    ];

    for (const versionBytes of versionByteOptions) {
      if (versionBytes.private === xprvVersionBytesNum) {
        const privateKeySlice = privateKey.slice(46, 78);
        const publicKey = secp256k1.publicFromPrivate(privateKeySlice);
        const pubVersionBytes = Buffer.from(
          versionBytes.public.toString(16).padStart(8, '0'),
          'hex',
        );
        const keyPair = getBitcoinECPair().fromPrivateKey(privateKeySlice, {
          network,
        });
        try {
          xpub = bs58check.encode(
            privateKey.fill(pubVersionBytes, 0, 4).fill(publicKey, 45, 78),
          );
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const publicKeyStr1 = keyPair.publicKey.toString('hex');
          const publicKeyStr2 = publicKey.toString('hex');
          // TODO publicKey is different with HD account
          //  - hd "03171d7528ce1cc199f2b8ce29ad7976de0535742169a8ba8b5a6dd55df7e589d1"
          //  - imported "020da363502074fefdfbb07ec47abc974207951dcb1aa3c910f4a768e2c70f9c68"
          pubKey = publicKeyStr2;
        } catch (e) {
          console.error(e);
        }
        break;
      }
    }
    if (xpub === '') {
      throw new OneKeyInternalError('Invalid X Private Key.');
    }

    let addressEncoding;
    let xpubSegwit = xpub;
    if (template) {
      if (template.startsWith(`m/44'/`)) {
        addressEncoding = EAddressEncodings.P2PKH;
      } else if (template.startsWith(`m/86'/`)) {
        addressEncoding = EAddressEncodings.P2TR;
        // TODO if (isTaprootPath(pathPrefix)) {
        xpubSegwit = `tr(${xpub})`;
      } else {
        addressEncoding = undefined;
      }
    }

    const firstAddressRelPath = '0/0';
    const { [firstAddressRelPath]: address } = this.getAddressFromXpub({
      network,
      xpub,
      relativePaths: [firstAddressRelPath],
      addressEncoding,
    });
    return Promise.resolve({
      publicKey: pubKey,
      xpub,
      xpubSegwit,
      address,
      addresses: { [firstAddressRelPath]: address },
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHdBtc,
  ): Promise<ICoreApiGetAddressesResult> {
    const {
      template,
      hdCredential,
      password,
      indexes,
      networkInfo: { networkChainCode },
      addressEncoding,
    } = query;
    const { seed, entropy } = hdCredential;

    // template:  "m/49'/0'/$$INDEX$$'/0/0"
    // { pathPrefix: "m/49'/0'", pathSuffix: "{index}'/0/0" }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);

    const seedBuffer = bufferUtils.toBuffer(seed);

    // relPaths:  ["0'", "1'"]
    const relPaths: string[] = indexes.map(
      (index) => `${index.toString()}'`, // btc
      // (index) => pathSuffix.replace('{index}', index.toString()), // evm
    );

    // pubkeyInfos.map(i=>i.path)
    //    ["m/49'/0'/0'", "m/49'/0'/1'"]
    const pubkeyInfos = batchGetPublicKeys(
      curveName,
      seedBuffer,
      password,
      pathPrefix, // m/49'/0'
      relPaths, // 0'   1'
    );

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    if (!networkChainCode) {
      throw new Error('networkChainCode is required');
    }

    const network = getBtcForkNetwork(networkChainCode);

    const { public: xpubVersionBytes } =
      ((network.segwitVersionBytes || {})[
        addressEncoding
      ] as typeof network.bip32) || network.bip32;

    const entropyBuffer = bufferUtils.toBuffer(entropy);
    const mnemonic = mnemonicFromEntropy(entropyBuffer, password);
    const root = getBitcoinBip32().fromSeed(mnemonicToSeedSync(mnemonic));
    const xpubBuffers = [
      Buffer.from(xpubVersionBytes.toString(16).padStart(8, '0'), 'hex'),
      Buffer.from([3]),
    ];

    const addresses = await Promise.all(
      pubkeyInfos.map((info, index) => {
        const { path, parentFingerPrint, extendedKey } = info;

        const node = root.derivePath(`${path}/0/0`);
        const keyPair = getBitcoinECPair().fromWIF(node.toWIF());
        const publicKey = keyPair.publicKey.toString('hex');

        const xpub = bs58check.encode(
          Buffer.concat([
            ...xpubBuffers,
            parentFingerPrint,
            Buffer.from(
              (indexes[index] + 2 ** 31).toString(16).padStart(8, '0'),
              'hex',
            ),
            extendedKey.chainCode,
            extendedKey.key,
          ]),
        );

        const firstAddressRelPath = '0/0';
        const relativePaths = [firstAddressRelPath];
        const { [firstAddressRelPath]: address } = this.getAddressFromXpub({
          network,
          xpub,
          relativePaths,
          addressEncoding,
        });

        let xpubSegwit = xpub;
        if (isTaprootPath(pathPrefix)) {
          const rootFingerprint = generateRootFingerprint(
            curveName,
            seedBuffer,
            password,
          );
          const fingerprint = Number(
            Buffer.from(rootFingerprint).readUInt32BE(0) || 0,
          )
            .toString(16)
            .padStart(8, '0');
          const descriptorPath = `${fingerprint}${path.substring(1)}`;
          xpubSegwit = `tr([${descriptorPath}]${xpub}/<0;1>/*)`;
        }

        const addressItem: ICoreApiGetAddressItem = {
          address,
          publicKey,
          path,
          xpub,
          xpubSegwit,
          addresses: { [firstAddressRelPath]: address },
        };
        return addressItem;
      }),
    );
    return { addresses };
  }

  // call collectInfoForSoftwareSign outside
  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const {
      password,
      unsignedTx,
      credentials,
      networkInfo: { networkChainCode },
      btcExtraInfo,
      account,
    } = payload;
    const { psbtHex, inputsToSign } = unsignedTx;

    if (!account.relPaths?.length) {
      throw new Error('BTC sign transaction need relPaths');
    }

    const network = getBtcForkNetwork(networkChainCode);

    // build signers
    const signers = await this.buildSignersMap({
      payload,
    });

    // signPsbtTransaction()
    if (psbtHex && inputsToSign) {
      const psbt = Psbt.fromHex(psbtHex, { network });
      return this.signPsbt({
        network,
        psbt,
        signers,
        inputsToSign,
      });
    }

    // signNormalTransaction()
    const psbt = await this.packTransaction({
      network,
      signers,
      payload,
    });

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < unsignedTx.inputs.length; ++i) {
      const { address } = unsignedTx.inputs[i];
      const signer = this.pickSigner(signers, address);
      const psbtInput = psbt.data.inputs[0];
      const bitcoinSigner = await this.getBitcoinSignerPro({
        signer,
        input: psbtInput,
        network,
      });
      await psbt.signInputAsync(i, bitcoinSigner);
    }

    psbt.validateSignaturesOfAllInputs(validator);
    psbt.finalizeAllInputs();

    const tx = psbt.extractTransaction();
    return {
      txid: tx.getId(),
      rawTx: tx.toHex(),
      psbtHex: undefined,
    };
  }

  pickSigner(
    signers: Partial<{ [address: string]: ISigner }>,
    address: string,
  ) {
    const signer = signers[address];
    if (!signer) {
      throw new Error(`BTC signer not found: ${address}`);
    }
    return signer;
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const {
      account,
      password,
      btcExtraInfo,
      networkInfo: { networkChainCode },
    } = payload;

    if (!account.relPaths?.length) {
      throw new Error('BTC sign message need relPaths');
    }

    const unsignedMsg = payload.unsignedMsg as IUnsignedMessageBtc;
    const network = getBtcForkNetwork(networkChainCode);

    const signers = await this.buildSignersMap({ payload });

    if (unsignedMsg.type === EMessageTypesBtc.BIP322_SIMPLE) {
      const buffer = await this.signBip322MessageSimple({
        account,
        message: unsignedMsg.message,
        signers,
        psbtNetwork: network,
      });
      return bufferUtils.bytesToHex(buffer);
    }

    const signer = this.pickSigner(signers, account.address);

    const privateKey = await signer.getPrvkey();
    const keyPair = getBitcoinECPair().fromPrivateKey(privateKey, {
      network,
    });
    const sigOptions = unsignedMsg.sigOptions || { segwitType: 'p2wpkh' };
    const signature = bitcoinMessage.sign(
      unsignedMsg.message,
      checkIsDefined(keyPair.privateKey),
      keyPair.compressed,
      sigOptions,
    );
    return bufferUtils.bytesToHex(signature);
  }
}
