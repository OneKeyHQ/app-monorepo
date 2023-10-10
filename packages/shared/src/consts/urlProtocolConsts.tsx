export const ONEKEY_APP_DEEP_LINK_NAME = 'onekey-wallet';
export const ONEKEY_APP_DEEP_LINK = `${ONEKEY_APP_DEEP_LINK_NAME}://`; // onekey:// will open onekey legacy
export const WALLET_CONNECT_DEEP_LINK_NAME = 'wc';
export const WALLET_CONNECT_DEEP_LINK = `${WALLET_CONNECT_DEEP_LINK_NAME}://`;

export const PROTOCOLS_SUPPORTED_TO_OPEN = [
  'http:' as const,
  'https:' as const,
  'ipfs:' as const,
  'localfs:' as const,
  // 'file:' as const,

  // OneKey legacy
  `${ONEKEY_APP_DEEP_LINK_NAME}:` as const,

  // wallet connct
  `${WALLET_CONNECT_DEEP_LINK_NAME}:` as const,
  'ethereum:' as const,

  // lightning network
  'lightning:' as const,

  // Supported thrid party wallets which was registered in info.plist
  'fireblocks-wc:' as const,
  'zerion:' as const,
  'rainbow:' as const,
  'trust:' as const,
  'metamask:' as const,
  'tpoutside:' as const,
  'imtokenv2:' as const,
  'bitkeep:' as const,
  'oneinch:' as const,
  'itms-appss:' as const,
  'itms-apps:' as const,
];
