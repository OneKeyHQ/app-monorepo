import { BIP32Factory } from 'bip32';
import {
  address as BitcoinJsAddress,
  Transaction,
  crypto,
  initEccLib,
  payments,
} from 'bitcoinjs-lib';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import bs58check from 'bs58check';
import { ECPairFactory } from 'ecpair';
import { cloneDeep, isNil, omit } from 'lodash';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type {
  IAddressValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { ISignPsbtParams } from '@onekeyhq/shared/types/ProviderApis/ProviderApiSui.type';

import {
  CKDPub,
  ecc,
  generateRootFingerprint,
  secp256k1,
} from '../../../secret';
import { EAddressEncodings } from '../../../types';

import { getBtcForkNetwork } from './networks';

import type { IBip32ExtendedKey } from '../../../secret';
import type {
  ICoreApiSignAccount,
  ICurveName,
  ITxInputToSign,
} from '../../../types';
import type { IBtcForkNetwork, IBtcForkSigner } from '../types';
import type { BIP32API } from 'bip32/types/bip32';
import type { Payment, Psbt, networks } from 'bitcoinjs-lib';
import type { TinySecp256k1Interface } from 'bitcoinjs-lib/src/types';
import type { ECPairAPI } from 'ecpair/src/ecpair';

export * from './networks';

let bip32: BIP32API | undefined;
let ECPair: ECPairAPI | undefined;
let isEccInit = false;

export function initBitcoinEcc() {
  if (!isEccInit) {
    initEccLib(ecc as unknown as TinySecp256k1Interface);
    isEccInit = true;
  }
}

export function getBitcoinBip32() {
  if (!bip32) {
    initBitcoinEcc();
    // @ts-expect-error
    bip32 = BIP32Factory(ecc);
  }
  return bip32;
}

export function getBitcoinECPair() {
  if (!ECPair) {
    initBitcoinEcc();
    // @ts-expect-error
    ECPair = ECPairFactory(ecc);
  }
  return ECPair;
}

function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
  return crypto.taggedHash(
    'TapTweak',
    Buffer.concat(h ? [pubKey, h] : [pubKey]),
  );
}

export function tweakSigner(
  privKey: Buffer,
  publicKey: Buffer,
  opts: {
    tweakHash?: Buffer;
    network?: IBtcForkNetwork;
    needTweak: boolean;
  } = { needTweak: true },
): IBtcForkSigner {
  // new Uint8Array(privKey.buffer) return 8192 length on NODE.js 20
  let privateKey: Uint8Array | null = new Uint8Array(privKey);
  if (!privateKey) {
    throw new Error('Private key is required for tweaking signer!');
  }
  if (publicKey[0] === 3) {
    privateKey = ecc.privateNegate(privateKey);
  }

  if (!privateKey) {
    throw new Error('Private key is required for tweaking signer!');
  }

  const tweakedPrivateKey = ecc.privateAdd(
    privateKey,
    tapTweakHash(toXOnly(publicKey), opts.tweakHash),
  );
  if (!tweakedPrivateKey) {
    throw new Error('Invalid tweaked private key!');
  }

  return getBitcoinECPair().fromPrivateKey(
    Buffer.from(opts.needTweak ? tweakedPrivateKey : privateKey),
    {
      network: opts.network,
    },
  );
}

const TX_OP_RETURN_SIZE_LIMIT = 80;

export const loadOPReturn = (
  opReturn: string,
  opReturnSizeLimit: number = TX_OP_RETURN_SIZE_LIMIT,
) => {
  if (opReturn.length > opReturnSizeLimit) {
    throw new Error('OP_RETURN data is too large.');
  }
  const buffer = Buffer.from(opReturn);
  return buffer.slice(0, opReturnSizeLimit);
};

export const isTaprootPath = (pathPrefix: string) =>
  pathPrefix.startsWith(`m/86'/`);

// eslint-disable-next-line spellcheck/spell-checker
// Taproot addresses start with 'bc1p' on mainnet
// eslint-disable-next-line spellcheck/spell-checker
// Taproot addresses start with 'tb1p' on testnet
export const isTaprootAddress = (address: string): boolean =>
  address.startsWith('bc1p') || address.startsWith('tb1p');

export function scriptPkToAddress(
  scriptPk: string | Buffer,
  psbtNetwork: networks.Network,
) {
  initBitcoinEcc();
  try {
    // 0/0
    const address = BitcoinJsAddress.fromOutputScript(
      typeof scriptPk === 'string' ? Buffer.from(scriptPk, 'hex') : scriptPk,
      psbtNetwork,
    );
    return address;
  } catch (e) {
    return '';
  }
}

export function getInputsToSignFromPsbt({
  psbt,
  psbtNetwork,
  account,
  isBtcWalletProvider,
}: {
  account: ICoreApiSignAccount;
  psbt: Psbt;
  psbtNetwork: networks.Network;
  isBtcWalletProvider: ISignPsbtParams['options']['isBtcWalletProvider'];
}) {
  const inputsToSign: ITxInputToSign[] = [];
  psbt.data.inputs.forEach((v, index) => {
    let script: any = null;
    let value = 0;
    if (v.witnessUtxo) {
      script = v.witnessUtxo.script;
      value = v.witnessUtxo.value;
    } else if (v.nonWitnessUtxo) {
      const tx = Transaction.fromBuffer(v.nonWitnessUtxo);
      const output = tx.outs[psbt.txInputs[index].index];
      script = output.script;
      value = output.value;
    }
    const isSigned = v.finalScriptSig || v.finalScriptWitness;

    if (script && !isSigned) {
      const address = scriptPkToAddress(script, psbtNetwork);
      // 0/0
      if (account.address === address) {
        inputsToSign.push({
          index,
          publicKey: checkIsDefined(account.pub),
          address,
          sighashTypes: v.sighashType ? [v.sighashType] : undefined,
        });
        // P2TR taproot
        if (account.template?.startsWith(`m/86'/`) && !v.tapInternalKey) {
          // slice pub length from 33 to 32
          v.tapInternalKey = toXOnly(
            Buffer.from(checkIsDefined(account.pub), 'hex'),
          );
        }
      } else if (isBtcWalletProvider) {
        // handle babylon
        inputsToSign.push({
          index,
          publicKey: checkIsDefined(account.pub),
          address: account.address,
          sighashTypes: v.sighashType ? [v.sighashType] : undefined,
        });
      }
    }
  });
  return inputsToSign;
}

export function isBRC20Token(tokenAddress?: string) {
  return (
    tokenAddress?.startsWith('brc20') || tokenAddress?.startsWith('brc-20')
  );
}

export function validateBtcXpub({ xpub }: { xpub: string }): IXpubValidation {
  let isValid = false;
  try {
    bs58check.decode(xpub);
    isValid = true;
  } catch (error) {
    //
  }
  return {
    isValid,
  };
}

export function validateBtcXprvt({
  xprvt,
}: {
  xprvt: string;
}): IXprvtValidation {
  let isValid = false;
  try {
    bs58check.decode(xprvt);
    isValid = true;
  } catch (error) {
    //
  }
  return {
    isValid,
  };
}

export function validateBtcAddress({
  network,
  address,
}: {
  network: IBtcForkNetwork;
  address: string;
}): IAddressValidation {
  let encoding: EAddressEncodings | undefined;

  if (isBRC20Token(address)) {
    return {
      isValid: true,
      normalizedAddress: address,
      displayAddress: address,
    };
  }

  try {
    const decoded = BitcoinJsAddress.fromBase58Check(address);
    if (decoded.version === network.pubKeyHash && decoded.hash.length === 20) {
      encoding = EAddressEncodings.P2PKH;
    } else if (
      decoded.version === network.scriptHash &&
      decoded.hash.length === 20
    ) {
      encoding = EAddressEncodings.P2SH_P2WPKH;
    }
  } catch (e) {
    errorUtils.autoPrintErrorIgnore(e);
    try {
      const decoded = BitcoinJsAddress.fromBech32(address);
      if (
        decoded.version === 0x00 &&
        decoded.prefix === network.bech32 &&
        decoded.data.length === 20
      ) {
        encoding = EAddressEncodings.P2WPKH;
      } else if (
        decoded.version === 0x00 &&
        decoded.prefix === network.bech32 &&
        decoded.data.length === 32
      ) {
        encoding = EAddressEncodings.P2WSH;
      } else if (
        decoded.version === 0x01 &&
        decoded.prefix === network.bech32 &&
        decoded.data.length === 32
      ) {
        encoding = EAddressEncodings.P2TR;
      }
    } catch (_) {
      errorUtils.autoPrintErrorIgnore(_);
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
        normalizedAddress: '',
        displayAddress: '',
      };
}

export function checkBtcAddressIsUsed(query: {
  xpub: string;
  xpubSegwit?: string;
  address: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}): Promise<{ isUsed: boolean }> {
  return Promise.resolve({ isUsed: true });
}

export function convertBtcXprvtToHex({
  xprvt,
}: {
  // base58 encoded xprvt
  xprvt: string;
}) {
  return bufferUtils.bytesToHex(bs58check.decode(xprvt));
}

export function getBtcXpubFromXprvt({
  network,
  privateKeyRaw,
}: {
  network: IBtcForkNetwork;
  privateKeyRaw: string; // hex privateKey
}) {
  const xprv = bufferUtils.toBuffer(privateKeyRaw);

  let xpub = '';
  // let pubKey = ''; // use getPublicKeyFromXpub get certain relPath 0/0 publicKey

  const xprvVersionBytesNum = parseInt(xprv.slice(0, 4).toString('hex'), 16);

  if (isNil(xprvVersionBytesNum) || Number.isNaN(xprvVersionBytesNum)) {
    throw new Error('Invalid X Private Key: xprvVersionBytesNum not found');
  }
  const versionByteOptions = [
    // ...Object.values(network.segwitVersionBytes || {}),
    ...Object.values(omit(network.segwitVersionBytes, EAddressEncodings.P2TR)),
    network.bip32,
  ];

  for (const versionBytes of versionByteOptions) {
    if (versionBytes.private === xprvVersionBytesNum) {
      const privateKeySlice = xprv.slice(46, 78);
      const publicKey = secp256k1.publicFromPrivate(privateKeySlice);
      const pubVersionBytes = Buffer.from(
        versionBytes.public.toString(16).padStart(8, '0'),
        'hex',
      );
      // const keyPair = getBitcoinECPair().fromPrivateKey(privateKeySlice, {
      //   network,
      // });
      try {
        xpub = bs58check.encode(
          xprv.fill(pubVersionBytes, 0, 4).fill(publicKey, 45, 78),
        );
        // const publicKeyStr1 = keyPair.publicKey.toString('hex');
        // const publicKeyStr2 = publicKey.toString('hex');
        // TODO publicKey is different with HD account
        //  - hd "03171d7528ce1cc199f2b8ce29ad7976de0535742169a8ba8b5a6dd55df7e589d1"
        //  - imported "020da363502074fefdfbb07ec47abc974207951dcb1aa3c910f4a768e2c70f9c68"
        // pubKey = publicKeyStr2;
      } catch (e) {
        console.error(e);
      }
      break;
    }
  }
  if (xpub === '') {
    throw new OneKeyInternalError('Invalid X Private Key.');
  }
  return { xpub };
}

export function getBtcVersionBytesToEncodings({
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

export function getBtcXpubSupportedAddressEncodings({
  xpub,
  network,
}: {
  network: IBtcForkNetwork;
  xpub: string; // base58 encoded xpub
}) {
  const decodedXpub = bs58check.decode(xpub);
  const versionBytes = parseInt(
    bufferUtils.bytesToHex(decodedXpub.slice(0, 4)),
    16,
  );
  const addressEncodingMap = getBtcVersionBytesToEncodings({
    networkChainCode: network.networkChainCode,
  });
  const supportEncodings = addressEncodingMap.public[versionBytes];

  return {
    supportEncodings,
  };
}

export function buildBtcXpubSegwit({
  xpub,
  addressEncoding: encoding,
  hdAccountPayload,
}: {
  xpub: string;
  addressEncoding: EAddressEncodings;
  hdAccountPayload?: {
    curveName: ICurveName;
    hdCredential: string;
    password: string;
    path: string;
  };
}) {
  let xpubSegwit = xpub;
  if (encoding === EAddressEncodings.P2TR) {
    xpubSegwit = `tr(${xpub})`;

    // with hd account descriptor
    // https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md
    // https://github.com/trezor/blockbook/blob/master/docs/api.md#get-xpub
    if (hdAccountPayload) {
      const { curveName, hdCredential, password, path } = hdAccountPayload;
      const rootFingerprint = generateRootFingerprint(
        curveName,
        hdCredential,
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
  }
  return xpubSegwit;
}

export function getBip32FromBase58({
  network,
  key,
}: {
  network: IBtcForkNetwork;
  key: string;
}) {
  // if (impl === IMPL_BTC) {
  //   network = getBtcForkNetwork('btc');
  // }
  // if (impl === IMPL_TBTC) {
  //   network = getBtcForkNetwork('tbtc');
  // }
  // if (!network) {
  //   throw new Error(`network not support: ${impl}`);
  // }

  // const accountNameInfoMap = getAccountNameInfoByImpl(IMPL_BTC);
  // const accountNameInfo = Object.values(accountNameInfoMap);

  const buffer = Buffer.from(bs58check.decode(key));
  const version = buffer.readUInt32BE(0);

  const versionByteOptions = [
    network.bip32,
    ...Object.values(network.segwitVersionBytes || {}),
  ];
  let bip32Info = cloneDeep(network.bip32);
  for (const versionByte of versionByteOptions) {
    if (versionByte.private === version || versionByte.public === version) {
      bip32Info = cloneDeep(versionByte);
      break;
    }
  }
  const newNetwork = cloneDeep(network);
  newNetwork.bip32 = bip32Info;
  const bip32Api = getBitcoinBip32().fromBase58(key, newNetwork);
  return bip32Api;
}

export function pubkeyToPayment({
  pubkey,
  encoding,
  network,
}: {
  pubkey: Buffer | undefined;
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
        // this input may not belongs to self, can not get pubkey
        internalPubkey: pubkey ? toXOnly(pubkey) : undefined,
        //    internalPubkey: pubkey ? pubkey.slice(1, 33) : undefined,
        network,
      });
      break;

    default:
      throw new Error(`Invalid encoding: ${encoding as string}`);
  }

  return payment;
}

export type IGetAddressFromXpubParams = {
  curve: ICurveName;
  network: IBtcForkNetwork;
  xpub: string;
  relativePaths: Array<string>;
  addressEncoding?: EAddressEncodings;
  encodeAddress: (address: string) => string;
};
export type IGetAddressFromXpubResult = {
  addresses: Record<string, string>;
  publicKeys: Record<string, string>;
  xpubSegwit: string;
};
export function getAddressFromXpub({
  curve,
  network,
  xpub,
  relativePaths,
  addressEncoding,
  encodeAddress,
}: IGetAddressFromXpubParams): Promise<IGetAddressFromXpubResult> {
  // Only used to generate addresses locally.
  const decodedXpub = bs58check.decode(xpub);
  const decodedXpubHex = bufferUtils.bytesToHex(decodedXpub);

  let encoding = addressEncoding;
  if (!encoding) {
    const { supportEncodings } = getBtcXpubSupportedAddressEncodings({
      network,
      xpub,
    });
    if (supportEncodings.length > 1) {
      throw new Error(
        'getAddressFromXpub ERROR: supportEncodings length > 1, you should specify addressEncoding by params',
      );
    }
    encoding = supportEncodings[0];
  }

  const xpubSegwit = buildBtcXpubSegwit({
    xpub,
    addressEncoding: encoding,
  });

  const ret: Record<string, string> = {};
  const publicKeys: Record<string, string> = {};

  const startExtendedKey: IBip32ExtendedKey = {
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
      extendedKey = CKDPub(curve, extendedKey, index);
      cache.set(relPath, extendedKey);
    }

    // const pubkey = taproot && inscribe ? fixedPublickey : extendedKey.key;
    let { address } = pubkeyToPayment({
      network,
      pubkey: extendedKey.key,
      encoding,
    });
    if (typeof address === 'string' && address.length > 0) {
      address = encodeAddress(address);
      ret[path] = address;
      publicKeys[path] = bufferUtils.bytesToHex(extendedKey.key);
    }
  }
  return Promise.resolve({ addresses: ret, publicKeys, xpubSegwit });
}

export function getPublicKeyFromXpub({
  xpub,
  network,
  relPath = '0/0',
}: {
  xpub: string;
  network: IBtcForkNetwork;
  relPath: string;
}) {
  const node = getBip32FromBase58({
    network,
    key: xpub,
  }).derivePath(relPath);

  const pub = node.publicKey.toString('hex');
  return pub;
}

/*
 const { getHDPath, getScriptType } = await CoreSDKLoader();
 const addressN = getHDPath(fullPath);
 const sdkScriptType = getScriptType(addressN);
*/
export function convertBtcScriptTypeForHardware(sdkScriptType: string) {
  const map: Record<string, number> = {
    SPENDADDRESS: 0,
    SPENDMULTISIG: 1,
    EXTERNAL: 2,
    SPENDWITNESS: 3,
    SPENDP2SHWITNESS: 4,
    SPENDTAPROOT: 5,
  };
  const val = map[sdkScriptType];

  if (isNil(val)) {
    throw new Error(`${sdkScriptType} not found in map`);
  }
  return val;
}
