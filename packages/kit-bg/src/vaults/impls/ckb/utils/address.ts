import { utils } from '@ckb-lumos/base';
import { generateAddress, parseAddress } from '@ckb-lumos/helpers';

import type { Script } from '@ckb-lumos/base';
import type { Config } from '@ckb-lumos/config-manager';
import type { Options } from '@ckb-lumos/helpers';

function blake160(publicKey: string): string {
  return new utils.CKBHasher().update(publicKey).digestHex().slice(0, 42);
}

export function scriptToAddress(
  script: Script,
  { config = undefined }: Options = {},
): string {
  // It needs to be replaced with encodeToAddress
  return generateAddress(script, { config });
}

export function pubkeyToAddress(
  publicKey: string,
  {
    config,
  }: {
    config: Config;
  },
): string {
  const args = blake160(publicKey);
  const template = config.SCRIPTS.SECP256K1_BLAKE160;

  if (!template) {
    throw new Error('SECP256K1_BLAKE160 not found in config');
  }

  const lockScript = {
    codeHash: template.CODE_HASH,
    hashType: template.HASH_TYPE,
    args,
  };
  return scriptToAddress(lockScript, { config });
}

export function isValidateAddress(
  address: string,
  { config = undefined }: Options = {},
): boolean {
  try {
    parseAddress(address, { config });
    return true;
  } catch {
    return false;
  }
}
