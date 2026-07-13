import { Image } from 'react-native';

// The share card is always rendered in light appearance regardless of the
// app theme, so colors are fixed literals instead of theme tokens.
export const SHARE_CARD_CONFIG = {
  width: 360,
  minHeight: 482,
  backgroundColor: '#FFFFFF',
  content: {
    paddingX: 32,
    paddingTop: 24,
    width: 296,
  },
  title: {
    size: 18,
    weight: 600,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.88)',
  },
  subtitle: {
    size: 12,
    weight: 400,
    lineHeight: 16,
    color: 'rgba(0,0,0,0.61)',
    emphasizedWeight: 500,
    emphasizedColor: 'rgba(0,0,0,0.88)',
    gapAboveTitle: 6,
  },
  wrapper: {
    gapAboveSubtitle: 16,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#F9F9F9',
    cellGap: 4,
  },
  cell: {
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0,0,0,0.05)',
  },
  qr: {
    size: 192,
    cellPaddingY: 25,
    logoPlateSize: 48,
    logoSize: 40,
    networkBadgeIconSize: 14,
    networkBadgePadding: 2,
  },
  addressCell: {
    paddingX: 17,
    paddingY: 13,
  },
  addressText: {
    size: 14,
    weight: 400,
    lineHeight: 20,
    color: 'rgba(0,0,0,0.88)',
    highlightColor: '#32B826',
    monoFontFamily:
      'GeistMono-Regular, ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  footer: {
    height: 52,
    paddingX: 16,
    paddingBottom: 16,
    logoSize: 28,
    logoTextGap: 8,
    logoText: 'OneKey',
    logoTextSize: 16,
    logoTextWeight: 600,
    logoTextColor: 'rgba(0,0,0,0.88)',
  },
} as const;

const ADDRESS_GROUP_SIZE = 4;
const ADDRESS_HIGHLIGHT_COUNT = 6; // leading and trailing highlighted chars

export function groupAddress(address: string): string {
  const groups: string[] = [];
  for (let i = 0; i < address.length; i += ADDRESS_GROUP_SIZE) {
    groups.push(address.slice(i, i + ADDRESS_GROUP_SIZE));
  }
  return groups.join(' ');
}

// Split the grouped address into leading / middle / trailing segments so the
// first and last N characters can be highlighted (mirrors HighlightAddress).
export function splitGroupedAddress(address: string): {
  leading: string;
  middle: string;
  trailing: string;
} {
  const grouped = groupAddress(address);
  const totalLen = address.length;
  if (totalLen <= ADDRESS_HIGHLIGHT_COUNT * 2) {
    return { leading: grouped, middle: '', trailing: '' };
  }
  // a space is inserted every ADDRESS_GROUP_SIZE chars in the grouped string
  const toGroupedPos = (origPos: number) =>
    origPos + Math.floor(origPos / ADDRESS_GROUP_SIZE);
  const leadEnd = toGroupedPos(ADDRESS_HIGHLIGHT_COUNT);
  const trailStart = toGroupedPos(totalLen - ADDRESS_HIGHLIGHT_COUNT);
  return {
    leading: grouped.slice(0, leadEnd),
    middle: grouped.slice(leadEnd, trailStart),
    trailing: grouped.slice(trailStart),
  };
}

// Webpack returns a URL string; Metro returns a numeric asset id requiring resolveAssetSource.
const logoAsset = require('@onekeyhq/kit/assets/logo.png') as number | string;

export const ONEKEY_LOGO_URL =
  typeof logoAsset === 'string'
    ? logoAsset
    : Image.resolveAssetSource(logoAsset).uri;
