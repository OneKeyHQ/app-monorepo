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
    monoFontFamily:
      'GeistMono-Medium, GeistMono-Regular, ui-monospace, SFMono-Regular, Menlo, monospace',
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

export function groupAddress(address: string, groupSize = 4): string {
  const groups: string[] = [];
  for (let i = 0; i < address.length; i += groupSize) {
    groups.push(address.slice(i, i + groupSize));
  }
  return groups.join(' ');
}

// Webpack returns a URL string; Metro returns a numeric asset id requiring resolveAssetSource.
const logoAsset = require('@onekeyhq/kit/assets/logo.png') as number | string;

export const ONEKEY_LOGO_URL =
  typeof logoAsset === 'string'
    ? logoAsset
    : Image.resolveAssetSource(logoAsset).uri;
