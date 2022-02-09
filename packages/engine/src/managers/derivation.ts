import { Buffer } from 'buffer';

import {
  CurveName,
  batchGetPublicKeys,
} from '@onekeyhq/blockchain-libs/dist/secret';

import { IMPL_EVM, IMPL_SOL } from '../constants';
import { OneKeyInternalError } from '../errors';

import { implToCoinTypes } from './impl';
// getXpub(impl, seed, password, path, dbNetwork.curve),
// generateTargetPath(impl, nextAccountIds, index, purpose);

type DerivationSettings = {
  accountLevel: number;
  targetLevel?: number;
  hardenedLevels: Array<number>;
};

const versionBytesMap: Record<string, Buffer> = {};

const purposeMap: Record<string, Array<number>> = {
  [IMPL_EVM]: [44],
  [IMPL_SOL]: [44],
};

const curveMap: Record<string, Array<CurveName>> = {
  [IMPL_EVM]: ['secp256k1'],
  [IMPL_SOL]: ['ed25519'],
};

const derivationSettings: Record<string, DerivationSettings> = {
  [IMPL_EVM]: {
    accountLevel: 5,
    hardenedLevels: [1, 2, 3],
  },
  [IMPL_SOL]: {
    accountLevel: 3,
    targetLevel: 4,
    hardenedLevels: [1, 2, 3, 4],
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
  let prefix = 'm';
  for (let level = 1; level < setting.accountLevel; level += 1) {
    const isHardened = setting.hardenedLevels.includes(level);
    const index = childrenIndexes[level] || 0;
    prefix += `/${index}${isHardened ? "'" : ''}`;
  }
  let relPaths = [];
  for (let index = start; index < start + limit; index += 1) {
    let childIndex = index;
    let isHardened = false;
    if (setting.hardenedLevels.includes(setting.accountLevel)) {
      isHardened = true;
    } else {
      isHardened = index >= 2 ** 31;
      childIndex -= isHardened ? 2 ** 31 : 0;
    }
    relPaths.push(`${childIndex}${isHardened ? "'" : ''}`);
  }
  if (
    typeof setting.targetLevel !== 'undefined' &&
    setting.targetLevel > setting.accountLevel
  ) {
    let suffix = '';
    for (
      let level = setting.accountLevel + 1;
      level <= setting.targetLevel;
      level += 1
    ) {
      const isHardened = setting.hardenedLevels.includes(level);
      const index = childrenIndexes[level] || 0;
      suffix += `/${index}${isHardened ? "'" : ''}`;
    }
    relPaths = relPaths.map((relPath) => `${relPath}${suffix}`);
  }

  const verionBytes = versionBytesMap[impl] || Buffer.from('0488b21e', 'hex');
  const depth = Buffer.from([setting.targetLevel || setting.accountLevel]);
  const paths: Array<string> = [];
  const xpubs: Array<Buffer> = [];

  batchGetPublicKeys(usedCurve, seed, password, prefix, relPaths).forEach(
    ({ path, parentFingerPrint, extendedKey }) => {
      const lastIndexStr = path.split('/').slice(-1)[0];
      const lastIndex = lastIndexStr.endsWith("'")
        ? parseInt(lastIndexStr.slice(0, -1)) + 2 ** 31
        : parseInt(lastIndexStr);
      paths.push(path);
      xpubs.push(
        Buffer.concat([
          verionBytes,
          depth,
          parentFingerPrint,
          Buffer.from(lastIndex.toString(16).padStart(8, '0'), 'hex'),
          extendedKey.chainCode,
          extendedKey.key,
        ]),
      );
    },
  );

  return { paths, xpubs };
}

function getDefaultPurpose(impl: string): number {
  return (purposeMap[impl] || [44])[0];
}

export { getXpubs, getDefaultPurpose };
