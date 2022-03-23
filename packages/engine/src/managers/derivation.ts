import { Buffer } from 'buffer';

import {
  CurveName,
  batchGetPublicKeys,
} from '@onekeyfe/blockchain-libs/dist/secret';
import bs58check from 'bs58check';

import {
  COINTYPE_ALGO,
  COINTYPE_CFX,
  COINTYPE_ETH,
  COINTYPE_NEAR,
  COINTYPE_SOL,
  COINTYPE_STC,
  IMPL_ALGO,
  IMPL_CFX,
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_SOL,
  IMPL_STC,
} from '../constants';
import { OneKeyInternalError } from '../errors';
import * as OneKeyHardware from '../hardware';
import { CredentialSelector, CredentialType } from '../types/credential';

import { implToCoinTypes } from './impl';

const versionBytesMap: Record<string, Buffer> = {};

const purposeMap: Record<string, Array<number>> = {
  [IMPL_EVM]: [44],
  [IMPL_SOL]: [44],
  [IMPL_ALGO]: [44],
  [IMPL_NEAR]: [44],
  [IMPL_STC]: [44],
  [IMPL_CFX]: [44],
};

const curveMap: Record<string, Array<CurveName>> = {
  [IMPL_EVM]: ['secp256k1'],
  [IMPL_SOL]: ['ed25519'],
  [IMPL_ALGO]: ['ed25519'],
  [IMPL_NEAR]: ['ed25519'],
  [IMPL_STC]: ['ed25519'],
  [IMPL_CFX]: ['secp256k1'],
};

// derive path template by coin types.
const INCREMENT_LEVEL_TAG = 'INCR';
const PURPOSE_TAG = 'PURPOSE';
const derivationPathTemplates: Record<string, string> = {
  [COINTYPE_ALGO]: `m/44'/${COINTYPE_ALGO}'/0'/0'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_ETH]: `m/44'/${COINTYPE_ETH}'/0'/0/${INCREMENT_LEVEL_TAG}`,
  [COINTYPE_NEAR]: `m/44'/${COINTYPE_NEAR}'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_SOL]: `m/44'/${COINTYPE_SOL}'/${INCREMENT_LEVEL_TAG}'/0'`,
  [COINTYPE_STC]: `m/44'/${COINTYPE_STC}'/0'/0'/${INCREMENT_LEVEL_TAG}'`,
  [COINTYPE_CFX]: `m/44'/${COINTYPE_CFX}'/0'/0/${INCREMENT_LEVEL_TAG}`,
};

function getDerivationPaths(
  purpose: string,
  coinType: string,
  indexes: Array<number>,
): { prefix: string; depth: number; relPaths: Array<string> } {
  if (indexes.some((index) => index >= 2 ** 31)) {
    throw new OneKeyInternalError(
      'Invalid child index, should be less than 2^31.',
    );
  }

  const template = derivationPathTemplates[coinType];
  if (typeof template === 'undefined') {
    throw new OneKeyInternalError(`Unsupported coinType ${coinType}.`);
  }
  const [prefix, suffix] = template.split(INCREMENT_LEVEL_TAG);
  const relPaths = indexes.map((index) => `${index}${suffix}`);
  return {
    prefix: prefix.slice(0, -1).replace(PURPOSE_TAG, purpose),
    depth: template.split('/').length - 1,
    relPaths,
  };
}

function getPath(purpose: string, coinType: string, index: number) {
  const { prefix, relPaths } = getDerivationPaths(purpose, coinType, [index]);
  return `${prefix}/${relPaths[0]}`;
}

async function getXpubs(
  impl: string,
  credential: CredentialSelector,
  outputFormat: 'xpub' | 'pub' | 'address',
  indexes: Array<number>,
  purpose?: number,
  curve?: string,
): Promise<Array<{ path: string; info: string }>> {
  const usedCurve = (curve || (curveMap[impl] || [])[0]) as CurveName;
  if (
    typeof usedCurve === 'undefined' ||
    !(curveMap[impl] || []).includes(usedCurve)
  ) {
    throw new OneKeyInternalError(
      `Invalid curve ${usedCurve} for impl ${impl}.`,
    );
  }

  const usedPurpose = purpose || (purposeMap[impl] || [])[0];
  if (
    typeof usedPurpose === 'undefined' ||
    !(purposeMap[impl] || []).includes(usedPurpose)
  ) {
    throw new OneKeyInternalError(
      `Invalid purpose ${usedPurpose} for impl ${impl}.`,
    );
  }

  const coinType = implToCoinTypes[impl];
  if (typeof coinType === 'undefined') {
    throw new OneKeyInternalError(`Cannot find coinType for impl ${impl}.`);
  }

  const { prefix, depth, relPaths } = getDerivationPaths(
    usedPurpose.toString(),
    coinType,
    indexes,
  );

  switch (credential.type) {
    case CredentialType.SOFTWARE:
      return batchGetPublicKeys(
        usedCurve,
        credential.seed,
        credential.password,
        prefix,
        relPaths,
      ).map(({ path, parentFingerPrint, extendedKey }) => {
        let info = '';
        if (outputFormat === 'pub') {
          info = extendedKey.key.toString('hex');
        }
        if (outputFormat === 'xpub') {
          const lastIndexStr = path.split('/').slice(-1)[0];
          const lastIndex = lastIndexStr.endsWith("'")
            ? parseInt(lastIndexStr.slice(0, -1)) + 2 ** 31
            : parseInt(lastIndexStr);
          const verionBytes =
            versionBytesMap[impl] || Buffer.from('0488b21e', 'hex');
          info = bs58check.encode(
            Buffer.concat([
              verionBytes,
              Buffer.from([depth]),
              parentFingerPrint,
              Buffer.from(lastIndex.toString(16).padStart(8, '0'), 'hex'),
              extendedKey.chainCode,
              extendedKey.key,
            ]),
          );
        }
        if (info.length === 0) {
          throw new OneKeyInternalError('Unable to get public key');
        }
        return { path, info };
      });
    case CredentialType.HARDWARE: {
      const paths = relPaths.map((relPath) => `${prefix}/${relPath}`);
      const ret = await OneKeyHardware.getXpubs(impl, paths, outputFormat);
      if (ret.length !== paths.length) {
        throw new OneKeyInternalError(
          `Hardware methods not supported for ${impl}`,
        );
      }
      return ret;
    }
    default:
      throw new OneKeyInternalError('Incorrect credential selector.');
  }
}

function getDefaultPurpose(impl: string): number {
  return (purposeMap[impl] || [44])[0];
}

export { getPath, getXpubs, getDefaultPurpose };
