import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

export const buildLocalTxStatusSyncId = (details: IStakeProtocolDetails) =>
  `${details.provider.name.toLowerCase()}-${details.token.info.symbol.toLowerCase()}`;

export function capitalizeString(str: string): string {
  if (!str) return str; // Return if the string is empty or undefined
  return str.charAt(0).toUpperCase() + str.slice(1);
}
