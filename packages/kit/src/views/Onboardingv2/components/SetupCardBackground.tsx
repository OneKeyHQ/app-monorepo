import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PixelShimmer from './PixelShimmer';
import { SetupCardGlow } from './SetupCard';

// The background effect for an elevated SetupCard. One treatment per platform so
// the two never stack: the always-on pixel shimmer on web (canvas), the radial
// glow on native (no canvas). Pass it to a card's `background` slot so it fills
// and is clipped by the card.
//
// `variant` carries the color theme, matched across both treatments:
//   - brand:   brand-green glow / green shimmer (e.g. ready, Recovery Phrase)
//   - neutral: white glow / white-ish shimmer (e.g. checking, OneKey SeedCard)

type ISetupCardBackgroundVariant = 'brand' | 'neutral';

// Brand-green glow; the web shimmer uses PixelShimmer's brand-green default.
const GLOW_BRAND = '#37FF35';
// White glow; paired with the neutral shimmer palette below.
const GLOW_NEUTRAL = '#FFFFFF';
// Neutral (white-ish) shimmer palette — parity with the Ledger card's shimmer
// in PickYourDevice.
const SHIMMER_NEUTRAL = ['#94A3B8', '#CBD5E1', '#A0AEC0'];

export interface ISetupCardBackgroundProps {
  variant: ISetupCardBackgroundVariant;
  // Native glow geometry (forwarded to SetupCardGlow); web shimmer ignores it.
  glowSize?: number;
  glowTop?: number;
  // Web shimmer field height in px. Clips the top-anchored canvas so its
  // centre-out origin (canvas height / 2) sits higher — e.g. over a card's top
  // illustration instead of the full-card centre. Native glow ignores it.
  shimmerHeight?: number;
}

export function SetupCardBackground({
  variant,
  glowSize,
  glowTop,
  shimmerHeight,
}: ISetupCardBackgroundProps) {
  if (platformEnv.isNative) {
    return (
      <SetupCardGlow
        color={variant === 'brand' ? GLOW_BRAND : GLOW_NEUTRAL}
        size={glowSize}
        top={glowTop}
      />
    );
  }
  return (
    <PixelShimmer
      autoPlay
      colors={variant === 'neutral' ? SHIMMER_NEUTRAL : undefined}
      style={{
        opacity: 0.5,
        ...(shimmerHeight === undefined ? null : { height: shimmerHeight }),
      }}
    />
  );
}
