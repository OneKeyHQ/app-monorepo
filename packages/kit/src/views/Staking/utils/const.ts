import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

// remove
export const LIDO_LOGO_URI =
  'https://uni.onekey-asset.com/static/logo/Lido.png';

export const LIDO_ETH_LOGO_URI =
  'https://uni.onekey-asset.com/static/chain/eth.png';

export const LIDO_MATIC_LOGO_URI =
  'https://uni.onekey-asset.com/static/chain/polygon.png';

export const LIDO_OFFICIAL_URL = 'https://lido.fi/';
// remove

export const buildLocalTxStatusSyncId = (details: IStakeProtocolDetails) =>
  `${details.provider.name.toLowerCase()}-${details.token.info.symbol.toLowerCase()}`;
