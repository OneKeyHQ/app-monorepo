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

const purposeMap: Record<string, Array<number>> = {
  [IMPL_EVM]: [44],
  [IMPL_SOL]: [44],
  [IMPL_ALGO]: [44],
  [IMPL_NEAR]: [44],
  [IMPL_STC]: [44],
  [IMPL_CFX]: [44],
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

function getDefaultPurpose(impl: string): number {
  return (purposeMap[impl] || [44])[0];
}

export { getPath, getDefaultPurpose };
