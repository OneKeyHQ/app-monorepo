/**
 * Single source of truth for the Bot Wallet key API contract shared between
 * the App (which registers/revokes keys when exporting a wallet to the CLI)
 * and the CLI (which fetches/revokes keys at runtime). Keep both sides
 * importing from here so they cannot drift out of sync.
 */
export const BOT_WALLET_KEY_API_PATH = '/prime/v1/bot-wallet-keys';
export const BOT_WALLET_KEY_API_TOKEN_HEADER = 'X-Onekey-Request-Token';
