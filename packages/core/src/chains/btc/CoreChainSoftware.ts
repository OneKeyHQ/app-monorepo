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
import { encode as VaruintBitCoinEncode } from 'varuint-bitcoin';

import { IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EMessageTypesBtc } from '@onekeyhq/shared/types/message';
import BigNumber from 'bignumber.js';
import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import {
  BaseBip32KeyDeriver,
  batchGetPublicKeys,
  decrypt,
  encrypt,
  mnemonicFromEntropy,
  secp256k1,
  verify,
} from '../../secret';
import {
  EAddressEncodings,
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
  type IEncodedTx,
  type ISignedTxPro,
  type ITxInputToSign,
  type IUnsignedMessageBtc,
} from '../../types';
import { slicePathTemplate } from '../../utils';

import {
  buildBtcXpubSegwit,
  getAddressFromXpub,
  getBitcoinBip32,
  getBitcoinECPair,
  getBtcForkNetwork,
  getBtcXpubFromXprvt,
  getInputsToSignFromPsbt,
  pubkeyToPayment,
  initBitcoinEcc,
  loadOPReturn,
  tweakSigner,
} from './sdkBtc';

import type { PsbtInput } from 'bip174/src/lib/interfaces';
import type { Payment, Signer, networks } from 'bitcoinjs-lib';
import type { ISigner } from '../../base/ChainSigner';
import type { IBip32ExtendedKey, IBip32KeyDeriver } from '../../secret';
import type {
  IBtcForkNetwork,
  IBtcForkTransactionMixin,
  IEncodedTxBtc,
} from './types';

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
    const { networkInfo, publicKey, addressEncoding } = query;
    const network = getBtcForkNetwork(networkInfo.networkChainCode);

    // 'BTC fork UTXO account should pass account xpub but not single address publicKey.',
    const xpub = publicKey;

    // only return first 0/0 relPath address for xpub account
    const firstRelPath = '0/0';
    const { addresses, xpubSegwit } = await this.getAddressFromXpub({
      network,
      xpub,
      relativePaths: [firstRelPath],
      addressEncoding,
    });
    return {
      address: addresses[firstRelPath],
      publicKey: '',
      xpub,
      xpubSegwit,
      addresses: addresses,
    };
  }

  // TODO memo and move to utils (file with getBtcForkNetwork)

  public async getAddressFromXpub({
    network,
    xpub,
    relativePaths,
    addressEncoding,
  }: {
    network: IBtcForkNetwork;
    xpub: string;
    relativePaths: Array<string>;
    addressEncoding?: EAddressEncodings;
  }): Promise<{
    addresses: Record<string, string>;
    xpubSegwit: string;
  }> {
    return getAddressFromXpub({
      curve: curveName,
      network,
      xpub,
      relativePaths,
      addressEncoding,
      encodeAddress: this.encodeAddress,
    });
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
    for (const [fullPath, privateKey] of Object.entries(privateKeys)) {
      const address = pathToAddresses?.[fullPath]?.address;
      if (!address) {
        throw new Error(
          'getSignersMap ERROR: address is required, is privateKeys including fullPath?',
        );
      }
      const signer = await this.buildSignerBtc({
        privateKey,
        password,
      });
      signers[address] = signer;
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
      const privateKeyHex = await signer.getPrvkeyHex();
      const publicKeyHex = await signer.getPubkeyHex();
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
    const { opReturn } = unsignedTx;
    const { inputs, outputs } = unsignedTx.encodedTx as IEncodedTxBtc;

    const inputAddressesEncodings = checkIsDefined(
      btcExtraInfo?.inputAddressesEncodings,
    );
    const nonWitnessPrevTxs = checkIsDefined(btcExtraInfo?.nonWitnessPrevTxs);

    const psbt = this.getPsbt({ network });

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < inputs.length; ++i) {
      const input = inputs[i];

      const inputValue: number = new BigNumber(input.value).toNumber();
      const encoding = inputAddressesEncodings[i];
      const mixin: IBtcForkTransactionMixin = {};

      const signer = this.pickSigner(signers, input.address);

      switch (encoding) {
        case EAddressEncodings.P2PKH:
          mixin.nonWitnessUtxo = Buffer.from(
            nonWitnessPrevTxs[input.txid],
            'hex',
          );
          break;
        case EAddressEncodings.P2WPKH:
          mixin.witnessUtxo = {
            script: checkIsDefined(
              pubkeyToPayment({
                pubkey: await signer.getPubkey(true),
                encoding,
                network,
              }),
            ).output as Buffer,
            value: inputValue,
          };
          break;
        case EAddressEncodings.P2SH_P2WPKH:
          {
            const payment = checkIsDefined(
              pubkeyToPayment({
                pubkey: await signer.getPubkey(true),
                encoding,
                network,
              }),
            );
            mixin.witnessUtxo = {
              script: payment.output as Buffer,
              value: inputValue,
            };
            mixin.redeemScript = payment.redeem?.output as Buffer;
          }
          break;
        case EAddressEncodings.P2TR:
          {
            const payment = checkIsDefined(
              pubkeyToPayment({
                pubkey: await signer.getPubkey(true),
                encoding,
                network,
              }),
            );
            mixin.witnessUtxo = {
              script: payment.output as Buffer,
              value: inputValue,
            };
            mixin.tapInternalKey = payment.internalPubkey;
          }
          break;
        default:
          break;
      }

      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        ...mixin,
      });
    }

    outputs.forEach((output) => {
      const outputValue: number = new BigNumber(output.value).toNumber();
      psbt.addOutput({
        address: output.address,
        value: outputValue,
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
    ) as IBip32KeyDeriver;

    // imported account return "" key as root privateKey
    const privateKey = privateKeys[''];
    const xprv = decrypt(password, bufferUtils.toBuffer(privateKey));
    const startKey = {
      chainCode: xprv.slice(13, 45),
      key: xprv.slice(46, 78),
    };

    const cache: Record<string, IBip32ExtendedKey> = {};

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
    encodedTx,
    account,
    message,
    signers,
    psbtNetwork,
  }: {
    encodedTx: IEncodedTx | null;
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
      encodedTx,
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
    encodedTx,
    network,
    psbt,
    signers,
    inputsToSign,
  }: {
    encodedTx: IEncodedTx | null;
    network: IBtcForkNetwork;
    psbt: Psbt;
    signers: Partial<{ [address: string]: ISigner }>;
    inputsToSign: ITxInputToSign[];
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
      encodedTx,
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
      privateKeyRaw, // xPrivateKey hex format but not single address privateKey
      networkInfo,
      addressEncoding,
    } = query;
    const network = getBtcForkNetwork(networkInfo.networkChainCode);

    const { xpub, pubKey } = getBtcXpubFromXprvt({
      privateKeyRaw, // hex privateKey
      network,
    });

    let usedAddressEncoding = addressEncoding;
    // if (template && !usedAddressEncoding) {
    //   if (template.startsWith(`m/44'/`)) {
    //     usedAddressEncoding = EAddressEncodings.P2PKH;
    //   } else if (template.startsWith(`m/86'/`)) {
    //     usedAddressEncoding = EAddressEncodings.P2TR;
    //   } else {
    //     usedAddressEncoding = undefined;
    //   }
    // }

    const firstAddressRelPath = '0/0';
    const { addresses, xpubSegwit } = await this.getAddressFromXpub({
      network,
      xpub,
      relativePaths: [firstAddressRelPath],
      addressEncoding: usedAddressEncoding,
    });
    const { [firstAddressRelPath]: address } = addresses;
    return Promise.resolve({
      publicKey: pubKey,
      xpub,
      xpubSegwit,
      relPath: firstAddressRelPath,
      address,
      addresses,
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

    // template:  "m/49'/0'/$$INDEX$$'/0/0"
    // { pathPrefix: "m/49'/0'", pathSuffix: "{index}'/0/0" }
    const { pathPrefix } = slicePathTemplate(template);

    // relPaths:  ["0'", "1'"]
    const relPaths: string[] = indexes.map(
      (index) => `${index.toString()}'`, // btc
      // (index) => pathSuffix.replace('{index}', index.toString()), // evm
    );

    // pubkeyInfos.map(i=>i.path)
    //    ["m/49'/0'/0'", "m/49'/0'/1'"]
    const pubkeyInfos = batchGetPublicKeys(
      curveName,
      hdCredential,
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

    const mnemonic = mnemonicFromEntropy(hdCredential, password);
    const root = getBitcoinBip32().fromSeed(mnemonicToSeedSync(mnemonic));
    const xpubBuffers = [
      Buffer.from(xpubVersionBytes.toString(16).padStart(8, '0'), 'hex'),
      Buffer.from([3]),
    ];

    const addresses = await Promise.all(
      pubkeyInfos.map(async (info, index) => {
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
        let { addresses, xpubSegwit } = await this.getAddressFromXpub({
          network,
          xpub,
          relativePaths,
          addressEncoding,
        });
        const { [firstAddressRelPath]: address } = addresses;

        // rebuild xpubSegwit by hd account descriptor
        xpubSegwit = buildBtcXpubSegwit({
          xpub,
          addressEncoding: addressEncoding,
          hdAccountPayload: {
            curveName,
            hdCredential,
            password,
            path,
          },
        });

        const addressItem: ICoreApiGetAddressItem = {
          address,
          publicKey,
          path,
          relPath: firstAddressRelPath,
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
      unsignedTx,
      networkInfo: { networkChainCode },
      account,
    } = payload;
    const { psbtHex, inputsToSign } = unsignedTx;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxBtc;

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
        encodedTx: unsignedTx.encodedTx,
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
    for (let i = 0; i < encodedTx.inputs.length; ++i) {
      const { address } = encodedTx.inputs[i];
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
      encodedTx: unsignedTx.encodedTx,
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
        encodedTx: null,
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
