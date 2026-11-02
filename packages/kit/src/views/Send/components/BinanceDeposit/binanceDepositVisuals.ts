import type { ImageSourcePropType } from 'react-native';

export const BINANCE_LOGO: ImageSourcePropType = require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_binance.png');
// The artwork is black to its edge, so on a dark page only a ring keeps its
// circle.
export const BINANCE_LOGO_RING = {
  borderWidth: '$px',
  borderColor: '$border',
} as const;

// The entry and every state of the recipient card, failures included,
// share one frame: the border and corner radius of the large address input
// these replace (the entry only shows on phones). The card, which holds a
// whole step, rounds its corners further.
export const CARD_FRAME = {
  p: '$4',
  gap: '$3',
  borderWidth: '$px',
  borderColor: '$borderStrong',
  borderRadius: '$3',
  borderCurve: 'continuous',
} as const;
