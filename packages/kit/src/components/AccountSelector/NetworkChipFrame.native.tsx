import type { ReactElement } from 'react';

import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Path } from 'react-native-svg';

import { Stack, XStack } from '@onekeyhq/components';
import { s } from '@onekeyhq/components/src/utils/scale';

import type {
  INetworkChipCut,
  INetworkChipFrameProps,
} from './NetworkChipFrame';

// The chips' own sizes, scaled like their tokens (Android scales them down on
// narrow screens): a $6 logo in a $0.5 frame, the next chip $2 over it, and
// the missing-address dot ($2, placed 2 in from the corner) with a $0.5 ring.
const FRAME = s(24) + 2 * s(2);
const RING = FRAME / 2;
const NEXT_LEFT = FRAME - s(8);
const DOT_CENTER = 2 + s(4);
const DOT_RING = s(4) + s(2);
const DOT_STRIP = DOT_CENTER + DOT_RING;

// A rectangle less a circle starting `left` in, `top` down to its center.
const cutout = (width: number, left: number, top: number, radius: number) =>
  `M0 0h${width}v${FRAME}H0z M${left} ${top}a${radius} ${radius} 0 1 0 ${
    2 * radius
  } 0a${radius} ${radius} 0 1 0 ${-2 * radius} 0z`;

// No CSS masks on native: the same outlines as holes in an SVG mask.
const CUTOUT_MASKS: Record<INetworkChipCut, ReactElement> = {
  // The frame less the next chip's ringed circle.
  next: (
    <Svg width={FRAME} height={FRAME}>
      <Path
        fill="#000"
        fillRule="evenodd"
        d={cutout(FRAME, NEXT_LEFT, RING, RING)}
      />
    </Svg>
  ),
  // The frame's last strip less the dot's ringed circle; the rest of the
  // frame, as wide as the +N count's digits make it, stays whole.
  dot: (
    <XStack flex={1}>
      <Stack flex={1} bg="#000" />
      <Svg width={DOT_STRIP} height={FRAME}>
        <Path
          fill="#000"
          fillRule="evenodd"
          d={cutout(
            DOT_STRIP,
            DOT_STRIP - DOT_CENTER - DOT_RING,
            DOT_CENTER,
            DOT_RING,
          )}
        />
      </Svg>
    </XStack>
  ),
};

export function NetworkChipFrame({
  cut,
  children,
  ...props
}: INetworkChipFrameProps) {
  const frame = <Stack p="$0.5">{children}</Stack>;
  return (
    <Stack {...props}>
      {cut ? (
        <MaskedView maskElement={CUTOUT_MASKS[cut]}>{frame}</MaskedView>
      ) : (
        frame
      )}
    </Stack>
  );
}
