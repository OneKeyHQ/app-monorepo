import type { IStackProps } from '@onekeyhq/components';
import { Stack } from '@onekeyhq/components';

// The 2 of clear space around a network chip (a 24 logo, or the +N count) in
// the All Networks trigger. Where the next chip, or the missing-address dot,
// overlaps a chip, the chip gives up that outline rather than being ringed in
// the page color, which showed on hover backgrounds and on the iOS glass
// capsule.
export type INetworkChipCut = 'next' | 'dot';

export type INetworkChipFrameProps = IStackProps & {
  // `next`: the next chip, 8 over the right side (a circle of 14 whose center
  // is 34 in and 14 down). `dot`: the dot in the top-right corner (a circle
  // of 6 whose center is 6 in from both edges).
  cut?: INetworkChipCut;
};

const NEXT_CHIP_CUTOUT =
  'radial-gradient(circle at 34px 14px, transparent 13.5px, #000 14px)';
const DOT_CUTOUT =
  'radial-gradient(circle at calc(100% - 6px) 6px, transparent 5.5px, #000 6px)';
const CUTOUT_STYLES: Record<INetworkChipCut, Record<string, string>> = {
  next: { maskImage: NEXT_CHIP_CUTOUT, WebkitMaskImage: NEXT_CHIP_CUTOUT },
  dot: { maskImage: DOT_CUTOUT, WebkitMaskImage: DOT_CUTOUT },
};

export function NetworkChipFrame({
  cut,
  children,
  ...props
}: INetworkChipFrameProps) {
  return (
    <Stack p="$0.5" {...props} style={cut ? CUTOUT_STYLES[cut] : undefined}>
      {children}
    </Stack>
  );
}
