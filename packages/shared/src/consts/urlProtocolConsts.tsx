export const ONEKEY_APP_DEEP_LINK_NAME = 'onekey-wallet';
export const ONEKEY_APP_DEEP_LINK = `${ONEKEY_APP_DEEP_LINK_NAME}://`; // onekey:// will open onekey legacy
export const WALLET_CONNECT_DEEP_LINK_NAME = 'wc';
export const WALLET_CONNECT_DEEP_LINK = `${WALLET_CONNECT_DEEP_LINK_NAME}://`;

export const PROTOCOLS_SUPPORTED_TO_OPEN = [
  // 'http:' as const,
  'https:' as const,
  // 'file:' as const,

  // // OneKey legacy
  // `${ONEKEY_APP_DEEP_LINK_NAME}:` as const,

  // // wallet connect
  // `${WALLET_CONNECT_DEEP_LINK_NAME}:` as const,
  // 'ethereum:' as const,

  // lightning network
  // 'lightning:' as const,
];
