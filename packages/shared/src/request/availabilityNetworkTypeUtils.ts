/**
 * Low-cardinality network type attached to API availability outcomes. Only
 * the connection kind is kept: carrier, Wi-Fi identifiers, IP addresses and link
 * quality are never read into availability metrics.
 */
export type IAvailabilityNetworkType =
  | 'cellular'
  | 'ethernet'
  | 'offline'
  | 'other'
  | 'unknown'
  | 'wifi';

export function normalizeAvailabilityConnectionType(
  type: unknown,
): IAvailabilityNetworkType {
  switch (typeof type === 'string' ? type.toLowerCase() : '') {
    case 'wifi':
      return 'wifi';
    case 'cellular':
      return 'cellular';
    case 'ethernet':
      return 'ethernet';
    case 'none':
      return 'offline';
    case 'bluetooth':
    case 'mixed':
    case 'other':
    case 'vpn':
    case 'wimax':
      return 'other';
    default:
      return 'unknown';
  }
}
