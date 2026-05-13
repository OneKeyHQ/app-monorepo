import { createHash } from 'crypto';

import { OneKeyLocalError } from '../../errors';

const BOT_WALLET_HASH_SALT = 'onekey-cli-bot-wallet-key-api:v1';
const BOT_WALLET_HASH_ALGORITHM = 'sha256';

export function buildBotWalletHash(walletId: string): string {
  if (!walletId) {
    throw new OneKeyLocalError('Bot Wallet hash requires a walletId');
  }
  return createHash(BOT_WALLET_HASH_ALGORITHM)
    .update(`${BOT_WALLET_HASH_SALT}:${walletId}`, 'utf8')
    .digest('hex');
}

export function isBotWalletHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

export const BOT_WALLET_HASH_INTERNALS = {
  BOT_WALLET_HASH_ALGORITHM,
  BOT_WALLET_HASH_SALT,
} as const;
