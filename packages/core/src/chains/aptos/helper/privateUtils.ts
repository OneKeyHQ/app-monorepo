import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import type { ICurveName } from '../../../types';

export const AIP80_PREFIXES: Record<ICurveName, string | undefined> = {
  'ed25519': 'ed25519-priv-',
  'secp256k1': 'secp256k1-priv-',
  'nistp256': undefined,
} as const;

export const PRIVATE_KEY_LENGTH = 64; // 32 bytes = 64 hex characters

export const getSupportedAlgorithms = (): ICurveName[] => {
  return ['ed25519'];
};

export const detectAlgorithm = (privateKey: string): ICurveName | null => {
  if (!privateKey || typeof privateKey !== 'string') {
    return null;
  }

  for (const [variant, prefix] of Object.entries(AIP80_PREFIXES)) {
    if (prefix && privateKey.startsWith(prefix)) {
      return variant as ICurveName;
    }
  }
  return null;
};

export const checkAlgorithmSupport = (
  privateKey: string,
): ICurveName | null => {
  const supportedAlgorithms = getSupportedAlgorithms();
  for (const algorithm of supportedAlgorithms) {
    const prefix = AIP80_PREFIXES[algorithm];
    if (prefix && privateKey.startsWith(prefix)) {
      return algorithm;
    }
  }
  return null;
};

export const stripPrefix = (privateKey: string): string => {
  for (const prefix of Object.values(AIP80_PREFIXES)) {
    if (prefix && privateKey.startsWith(prefix)) {
      return privateKey.slice(prefix.length);
    }
  }
  return privateKey;
};

export const addPrefix = (
  privateKey: string,
  algorithm: ICurveName,
): string => {
  const prefix = AIP80_PREFIXES[algorithm];
  if (!prefix) {
    throw new OneKeyLocalError(`Unsupported algorithm: ${algorithm}`);
  }
  if (privateKey.startsWith(prefix)) {
    return privateKey;
  }
  return prefix + privateKey;
};

export const validatePrivateKey = (privateKey: string): boolean => {
  if (!privateKey || typeof privateKey !== 'string') {
    return false;
  }

  const algorithm = checkAlgorithmSupport(privateKey);

  let rawPrivateKey = privateKey;

  if (algorithm) {
    rawPrivateKey = stripPrefix(privateKey);
  }

  const isHexPrefix = hexUtils.hasHexPrefix(rawPrivateKey);
  const isValidHex = hexUtils.isHexString(rawPrivateKey);
  const hasCorrectLength =
    hexUtils.stripHexPrefix(rawPrivateKey).length === PRIVATE_KEY_LENGTH;

  const isValid = isHexPrefix && isValidHex && hasCorrectLength;

  return isValid;
};

export const isAIP80Format = (privateKey: string): boolean => {
  return detectAlgorithm(privateKey) !== null;
};

export const isLegacyFormat = (privateKey: string): boolean => {
  return !isAIP80Format(privateKey) && validatePrivateKey(privateKey);
};

export const normalizePrivateKey = (
  privateKey: string,
  targetFormat: 'legacy' | 'aip80',
  algorithm?: ICurveName,
): string => {
  if (!privateKey || typeof privateKey !== 'string') {
    throw new OneKeyLocalError('Invalid private key format');
  }

  let rawPrivateKey = privateKey;
  if (!isAIP80Format(rawPrivateKey)) {
    rawPrivateKey = hexUtils.addHexPrefix(rawPrivateKey);
  }

  const validation = validatePrivateKey(rawPrivateKey);
  if (!validation) {
    throw new OneKeyLocalError('Invalid private key format');
  }

  if (targetFormat === 'legacy') {
    return stripPrefix(rawPrivateKey);
  }

  if (targetFormat === 'aip80') {
    if (!algorithm) {
      throw new OneKeyLocalError('Algorithm type is required for AIP80 format');
    }
    return addPrefix(rawPrivateKey, algorithm);
  }

  throw new OneKeyLocalError('Unsupported target format');
};
