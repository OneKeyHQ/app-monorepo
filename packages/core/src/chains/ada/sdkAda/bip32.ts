/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

// @ts-expect-error
import { bech32, mnemonicToRootKeypair, toPublic } from 'cardano-crypto.js';

import { mnemonicFromEntropy } from '@onekeyhq/core/src/secret';

import { DERIVATION_SCHEME, HARDENED_THRESHOLD } from './constants';

import { ICoreHdCredentialEncryptHex } from '../../../types';
import type { IAdaBIP32Path } from '../types';

export function toBip32StringPath(derivationPath: IAdaBIP32Path) {
  return `m/${derivationPath
    .map(
      (item) =>
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        (item % HARDENED_THRESHOLD) + (item >= HARDENED_THRESHOLD ? "'" : ''),
    )
    .join('/')}`;
}

export function getPathIndex(path: string) {
  return path.split('/').slice(3, 4)[0].slice(0, -1);
}

export async function getRootKey(
  password: string,
  hdCredential: ICoreHdCredentialEncryptHex,
): Promise<Buffer> {
  const mnemonic = mnemonicFromEntropy(hdCredential, password);
  const rootKey = await mnemonicToRootKeypair(mnemonic, DERIVATION_SCHEME);
  return rootKey;
}

export async function getXprvString(
  password: Buffer,
  entropy?: string,
): Promise<string>;
export async function getXprvString(
  password: string,
  entropy: Buffer,
): Promise<string>;
export async function getXprvString(
  password: any,
  entropy: any,
): Promise<string> {
  const rootKey =
    typeof password === 'string'
      ? await getRootKey(password, entropy)
      : password;
  const xprv = bech32.encode(
    'xprv',
    Buffer.concat([rootKey.slice(0, 64), rootKey.slice(96)]),
  ) as string;
  return xprv;
}

export async function generateExportedCredential(
  password: string,
  hdCredential: ICoreHdCredentialEncryptHex,
  path: string,
) {
  const index = getPathIndex(path);
  const rootKey = await getRootKey(password, hdCredential);
  const xprv = bech32.encode(
    'xprv',
    Buffer.concat([
      rootKey.slice(0, 64),
      rootKey.slice(96, 128),
      Buffer.from(index, 'utf8'),
    ]),
  ) as string;
  return xprv;
}

/*
 * @param xprv xprv string, 165 length, generate from OneKey wallet
 */
export function decodePrivateKeyByXprv(xprv: string) {
  const decodeXprv = bech32.decode(xprv);
  const index = decodeXprv.data.slice(96);
  const publicKey = toPublic(decodeXprv.data.slice(0, 64));
  const privateKey = Buffer.concat([
    decodeXprv.data.slice(0, 64),
    publicKey,
    decodeXprv.data.slice(64, 96),
    index,
  ]);
  return privateKey;
}

export function encodePrivateKey(privateKey: Buffer) {
  return {
    rootKey: privateKey.slice(0, 128),
    index: Buffer.from(privateKey.slice(128)).toString('utf8'),
  };
}

export function generateXprvFromPrivateKey(privateKey: Buffer) {
  // const { rootKey, index } = encodePrivateKey(privateKey);
  // const xprv = bech32.encode(
  //   'xprv',
  //   Buffer.concat([
  //     rootKey.slice(0, 64),
  //     rootKey.slice(96, 128),
  //     Buffer.from(index, 'utf8'),
  //   ]),
  // ) as string;

  const xprv = bech32.encode(
    'xprv',
    Buffer.concat([privateKey.slice(0, 64), privateKey.slice(96)]),
  ) as string;

  return xprv;
}
