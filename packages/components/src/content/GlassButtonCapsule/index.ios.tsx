import type { PropsWithChildren } from 'react';

import { XStack } from '../../primitives';
import { GlassHeaderProvider } from '../../primitives/Button/GlassHeaderContext';
import { GlassView, isLiquidGlassAvailable } from '../GlassView';

// Stadium/pill shape — borderRadius caps at half the height, so a row of buttons
// renders as a single capsule (a lone button would render as a circle). The bare
// buttons (see below) have clean square boxes, so the height is the icon box.
const glassPillStyle = {
  borderRadius: 9999,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

// Wraps one or more header icon buttons in a SINGLE iOS 26 Liquid Glass capsule.
// In-page header buttons (e.g. the Home tab header hides the native nav bar and
// draws its own row) can't get the system bar-button glass, so we render one
// `expo-glass-effect` GlassView behind the buttons to match the grouped system
// look (multiple icons sharing one glass pill, like the iOS 26 nav bar).
//
// GlassHeaderProvider tells the inner IconButtons they sit inside a glass
// container, so they bare-ify: drop self-drawn background/press, reset the
// tertiary negative margin (icons center in the capsule) and raise icon
// contrast — the same signal the native nav-bar capsule relies on.
//
// Gated on isLiquidGlassAvailable() (true only on iOS 26+ with the material);
// older iOS falls back to the plain buttons, no glass and no bare-ify.
export function GlassButtonCapsule({ children }: PropsWithChildren) {
  if (!isLiquidGlassAvailable()) {
    return <>{children}</>;
  }
  return (
    <GlassView isInteractive glassEffectStyle="regular" style={glassPillStyle}>
      <GlassHeaderProvider>
        {/* Padding tuned to match the native nav-bar glass capsule (the one on
            the Menu / Action Center page): the system wraps its bar button in a
            capsule that's bigger than the bare icon box and insets the icon
            more, so add room around the row. These are the tuning knobs —
            py ≈ capsule height / vertical inset, px ≈ horizontal end inset,
            gap ≈ space between the two icons. */}
        <XStack alignItems="center" py="$1" px="$1.5" gap="$2.5">
          {children}
        </XStack>
      </GlassHeaderProvider>
    </GlassView>
  );
}
