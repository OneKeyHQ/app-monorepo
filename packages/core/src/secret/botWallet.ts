import { InvalidMnemonic, OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  entropyToMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
} from './bip39';
import { hmacSHA512Sync } from './hash';

const DERIVATION_DOMAIN = 'onekey-bot-wallet';

function ensureValidIndex(index: number) {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new OneKeyLocalError('Invalid index.');
  }
}

// Derive an isolated Bot wallet mnemonic from a Keyless parent mnemonic.
export function deriveBotMnemonic(
  parentMnemonic: string,
  index: number,
): string {
  ensureValidIndex(index);

  if (!validateMnemonic(parentMnemonic)) {
    throw new InvalidMnemonic();
  }

  let parentSeed: Buffer | undefined;
  let derived: Buffer | undefined;

  try {
    parentSeed = mnemonicToSeedSync(parentMnemonic);
    derived = hmacSHA512Sync(
      parentSeed,
      Buffer.from(`${DERIVATION_DOMAIN}-${index}`, 'utf8'),
    );

    const botMnemonic = entropyToMnemonic(derived.slice(0, 16));

    if (!validateMnemonic(botMnemonic)) {
      throw new OneKeyLocalError('Invalid bot mnemonic.');
    }

    return botMnemonic;
  } finally {
    parentSeed?.fill(0);
    derived?.fill(0);
  }
}
