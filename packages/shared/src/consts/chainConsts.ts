export const BTC_TX_PLACEHOLDER_VSIZE = 79; // calculate_vsize(["P2WPKH"], [])
export const BTC_FIRST_TAPROOT_PATH = "m/86'/0'/0'";

// Tron constants live in shared/consts so the eager main bundle does not
// have to reach into @onekeyhq/core/src/chains/ (forbidden in the main
// bundle under the three-bundle rules). All entries are pure data with no
// runtime dependencies, so keeping them in the common layer is safe.
export const tronTokenAddressMainnet: Record<string, string> = {
  TRX: 'native',
  USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  USDD: 'TXDk8mbtRbXeYuMNS83CfKPaYYT8XWv9Hz',
};

export const tronTokenAddressTestnet: Record<string, string> = {
  TRX: 'native',
  USDT: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
  USDD: 'TLSKhknqGdvLZyEocevYQ4FTygCVR7PB6F',
};

export const TRON_SOURCE_FLAG_TESTNET = 'test';
export const TRON_SOURCE_FLAG_MAINNET = '1key';

export const TRON_MESSAGE_PREFIX = '\x19TRON Signed Message:\n';

export const TRON_TX_EXPIRATION_TIME = 60 * 10; // 10 minutes

export const TRON_SCAN_STAKING_URL = 'https://tronscan.io/#/wallet/resources';
export const TRON_SCAN_VOTE_URL = 'https://tronscan.io/#/sr/votes';
