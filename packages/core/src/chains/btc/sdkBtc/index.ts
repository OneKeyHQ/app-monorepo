import { BIP32Factory } from 'bip32';
import {
  address as BitcoinJsAddress,
  Transaction,
  crypto,
  initEccLib,
} from 'bitcoinjs-lib';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import { ECPairFactory } from 'ecpair';

import { ecc } from '../../../secret';

import { IAddressValidation } from '@onekeyhq/shared/types/address';
import type { BIP32API } from 'bip32/types/bip32';
import type { Psbt, networks } from 'bitcoinjs-lib';
import type { TinySecp256k1Interface } from 'bitcoinjs-lib/src/types';
import type { ECPairAPI } from 'ecpair/src/ecpair';
import {
  EAddressEncodings,
  type ICoreApiSignAccount,
  type ITxInputToSign,
} from '../../../types';
import type { IBtcForkNetwork, IBtcForkSigner } from '../types';

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
  opts: { tweakHash?: Buffer; network?: IBtcForkNetwork } = {},
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

  return getBitcoinECPair().fromPrivateKey(Buffer.from(tweakedPrivateKey), {
    network: opts.network,
  });
}

const TX_OP_RETURN_SIZE_LIMIT = 80;

export const loadOPReturn = (
  opReturn: string,
  opReturnSizeLimit: number = TX_OP_RETURN_SIZE_LIMIT,
) => {
  const buffer = Buffer.from(opReturn);
  return buffer.slice(0, opReturnSizeLimit);
};

export const isTaprootPath = (pathPrefix: string) =>
  pathPrefix.startsWith(`m/86'/`);

export function getInputsToSignFromPsbt({
  psbt,
  psbtNetwork,
  account,
}: {
  account: ICoreApiSignAccount;
  psbt: Psbt;
  psbtNetwork: networks.Network;
}) {
  const inputsToSign: ITxInputToSign[] = [];
  psbt.data.inputs.forEach((v, index) => {
    let script: any = null;
    if (v.witnessUtxo) {
      script = v.witnessUtxo.script;
    } else if (v.nonWitnessUtxo) {
      const tx = Transaction.fromBuffer(v.nonWitnessUtxo);
      const output = tx.outs[psbt.txInputs[index].index];
      script = output.script;
    }
    const isSigned = v.finalScriptSig || v.finalScriptWitness;

    if (script && !isSigned) {
      const address = BitcoinJsAddress.fromOutputScript(script, psbtNetwork);
      if (account.address === address) {
        const pubKeyStr = account.pubKey as string;
        if (!pubKeyStr) {
          throw new Error('pubKey is empty');
        }
        inputsToSign.push({
          index,
          publicKey: pubKeyStr,
          address,
          sighashTypes: v.sighashType ? [v.sighashType] : undefined,
        });
        if (
          (account.template as string).startsWith(`m/86'/`) &&
          !v.tapInternalKey
        ) {
          v.tapInternalKey = toXOnly(Buffer.from(pubKeyStr, 'hex'));
        }
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
