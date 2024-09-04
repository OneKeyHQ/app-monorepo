import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

export const buildLocalTxStatusSyncId = (details: IStakeProtocolDetails) =>
  `${details.provider.name.toLowerCase()}-${details.token.info.symbol.toLowerCase()}`;

export function capitalizeString(str: string): string {
  if (!str) return str; // Return if the string is empty or undefined
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const formatBabylonUnlockTime = (d: number) => {
  const currentDate = new Date();
  const endDate = new Date(currentDate.getTime() + d);
  return formatDate(endDate, { hideTimeForever: true });
};
