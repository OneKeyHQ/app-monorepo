import type { ReactElement } from 'react';

import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Path } from 'react-native-svg';

import { Stack, XStack } from '@onekeyhq/components';

import type {
  INetworkChipCut,
  INetworkChipFrameProps,
} from './NetworkChipFrame';

// No CSS masks on native: the same outlines as holes in an SVG mask.
const CUTOUT_MASKS: Record<INetworkChipCut, ReactElement> = {
  // The 28 frame less the next chip's circle of 14, centered 34 in.
  next: (
    <Svg width={28} height={28}>
      <Path
        fill="#000"
        fillRule="evenodd"
        d="M0 0h28v28H0z M20 14a14 14 0 1 0 28 0a14 14 0 1 0 -28 0z"
      />
    </Svg>
  ),
  // The frame's last 12 less the dot's circle of 6; the rest of the frame,
  // as wide as the +N count's digits make it, stays whole.
  dot: (
    <XStack flex={1}>
      <Stack flex={1} bg="#000" />
      <Svg width={12} height={28}>
        <Path
          fill="#000"
          fillRule="evenodd"
          d="M0 0h12v28H0z M0 6a6 6 0 1 0 12 0a6 6 0 1 0 -12 0z"
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
