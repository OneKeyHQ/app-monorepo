import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

// remove
export const LIDO_LOGO_URI =
  'https://uni.onekey-asset.com/static/logo/Lido.png';

export const buildLocalTxStatusSyncId = (details: IStakeProtocolDetails) =>
  `${details.provider.name.toLowerCase()}-${details.token.info.symbol.toLowerCase()}`;
