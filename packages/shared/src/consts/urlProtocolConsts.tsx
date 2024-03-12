import {
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK_NAME,
} from './deeplinkConsts';

export const VALID_DEEP_LINK = [
  // OneKey legacy
  `${ONEKEY_APP_DEEP_LINK_NAME}:` as const,

  // wallet connect
  `${WALLET_CONNECT_DEEP_LINK_NAME}:` as const,
];

export const PROTOCOLS_SUPPORTED_TO_OPEN = [
  // 'http:' as const,
  'https:' as const,
  // 'file:' as const,

  ...VALID_DEEP_LINK,
  // 'ethereum:' as const,

  // lightning network
  // 'lightning:' as const,
];
