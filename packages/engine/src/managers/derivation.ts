import { Buffer } from 'buffer';
import * as crypto from 'crypto';

import {
  CKDPriv,
  CurveName,
  ExtendedKey,
  N,
  generateMasterKeyFromSeed,
} from '@onekeyhq/blockchain-libs/dist/secret';

import { IMPL_EVM } from '../constants';
import { OneKeyInternalError } from '../errors';

import { implToCoinTypes } from './impl';
// getXpub(impl, seed, password, path, dbNetwork.curve),
// generateTargetPath(impl, nextAccountIds, index, purpose);

type DerivationSettings = {
  accountLevel: number;
  hardenedLevels: Array<number>;
};

const versionBytesMap: Record<string, Buffer> = {};

const purposeMap: Record<string, Array<number>> = {
  [IMPL_EVM]: [44],
};

const curveMap: Record<string, Array<CurveName>> = {
  [IMPL_EVM]: ['secp256k1'],
};

const derivationSettings: Record<string, DerivationSettings> = {
  [IMPL_EVM]: {
    accountLevel: 5,
    hardenedLevels: [1, 2, 3],
  },
};

function getXpubs(
  impl: string,
  seed: Buffer,
  password: string,
  start = 0,
  limit = 10,
  purpose?: number,
  curve?: string,
): { paths: Array<string>; xpubs: Array<Buffer> } {
  const usedPurpose = purpose || (purposeMap[impl] || [])[0];
  if (
    typeof usedPurpose === 'undefined' ||
    !(purposeMap[impl] || []).includes(usedPurpose)
  ) {
    throw new OneKeyInternalError(
      `Invalid purpose ${usedPurpose} for impl ${impl}.`,
    );
  }
  const usedCurve = (curve || (curveMap[impl] || [])[0]) as CurveName;
  if (
    typeof usedCurve === 'undefined' ||
    !(curveMap[impl] || []).includes(usedCurve)
  ) {
    throw new OneKeyInternalError(
      `Invalid curve ${usedCurve} for impl ${impl}.`,
    );
  }
  const setting = derivationSettings[impl];
  if (typeof setting === 'undefined') {
    throw new OneKeyInternalError(
      `Cannot find derivation setting for impl ${impl}.`,
    );
  }
  const coinType = implToCoinTypes[impl];
  if (typeof coinType === 'undefined') {
    throw new OneKeyInternalError(`Cannot find coinType for impl ${impl}.`);
  }

  const childrenIndexes = [0, usedPurpose, Number.parseInt(coinType)];
  let path = 'm';
  let parentExtendedKey: ExtendedKey = generateMasterKeyFromSeed(
    usedCurve,
    seed,
    password,
  );
  for (let level = 1; level < setting.accountLevel; level += 1) {
    const isHardened = setting.hardenedLevels.includes(level);
    const index = childrenIndexes[level] || 0;
    path += `/${index}${isHardened ? "'" : ''}`;
    parentExtendedKey = CKDPriv(
      usedCurve,
      parentExtendedKey,
      index + (isHardened ? 2 ** 31 : 0),
      password,
    );
  }

  const paths = [];
  const xpubs = [];
  const verionBytes = versionBytesMap[impl] || Buffer.from('0488b21e', 'hex');
  const depth = Buffer.from([setting.accountLevel]);
  const fingerprint = crypto
    .createHash('ripemd160')
    .update(
      crypto
        .createHash('sha256')
        .update(N(usedCurve, parentExtendedKey, password).key)
        .digest(),
    )
    .digest()
    .slice(0, 4);
  for (let index = start; index < start + limit; index += 1) {
    const isHardened = setting.hardenedLevels.includes(setting.accountLevel);
    const childIndex = index + (isHardened ? 2 ** 31 : 0);
    const extPub = N(
      usedCurve,
      CKDPriv(usedCurve, parentExtendedKey, childIndex, password),
      password,
    );
    paths.push(`${path}/${index}${isHardened ? "'" : ''}`);
    xpubs.push(
      Buffer.concat([
        verionBytes,
        depth,
        fingerprint,
        Buffer.from(childIndex.toString().padStart(8, '0'), 'hex'),
        extPub.chainCode,
        extPub.key,
      ]),
    );
  }

  return { paths, xpubs };
}

function getDefaultPurpose(impl: string): number {
  return (purposeMap[impl] || [44])[0];
}

export { getXpubs, getDefaultPurpose };
