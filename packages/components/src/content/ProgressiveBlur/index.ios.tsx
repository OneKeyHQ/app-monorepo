import MaskedView from '@react-native-masked-view/masked-view';
import { StyleSheet } from 'react-native';

import { BlurView } from '../BlurView';
import { LinearGradient } from '../LinearGradient';

// Mask alpha: opaque (frost visible) down to 55% of the height, then ramps to
// transparent (frost hidden) at the bottom edge — a progressive falloff.
const MASK_COLORS = ['#000000', '#000000', 'transparent'];
const MASK_LOCATIONS: [number, number, number] = [0, 0.55, 1];
const MASK_START: [number, number] = [0, 0];
const MASK_END: [number, number] = [0, 1];
// Blur strength (0-100). Kept light so the frost reads as translucent.
const BLUR_INTENSITY = 25;

const MASK_ELEMENT = (
  <LinearGradient
    style={StyleSheet.absoluteFill}
    colors={MASK_COLORS}
    locations={MASK_LOCATIONS}
    start={MASK_START}
    end={MASK_END}
  />
);

// iOS-only "progressive blur": a frost whose opacity fades to transparent toward
// the bottom edge via a vertical alpha gradient mask, mimicking the native
// nav-bar scroll-edge look so content scrolling underneath dissolves softly
// instead of meeting a hard, uniformly-blurred rectangle. Fills its parent.
//
// Uses BlurView (UIBlurEffect), NOT GlassView: a CALayer alpha mask composites
// cleanly over a UIVisualEffectView, but breaks the iOS 26 Liquid Glass
// material (it renders nothing when masked). Liquid Glass stays on the header's
// pills/capsules; this is the frosted BACKDROP behind them. Masking is native,
// so it is GPU-cheap — no per-frame JS work.
export function ProgressiveBlur() {
  return (
    <MaskedView style={StyleSheet.absoluteFill} maskElement={MASK_ELEMENT}>
      <BlurView flex={1} intensity={BLUR_INTENSITY} />
    </MaskedView>
  );
}
