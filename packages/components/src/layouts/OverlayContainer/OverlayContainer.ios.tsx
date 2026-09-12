import type { ComponentProps, ComponentType } from 'react';

import { FullWindowOverlay } from 'react-native-screens';

import type { IOverlayContainerProps } from './type';

type PatchedFullWindowOverlayProps = ComponentProps<
  typeof FullWindowOverlay
> & {
  bringToFrontToken?: number;
};

// The tracked react-native-screens patch adds this native prop, while the
// installed package declaration may still come from the unpatched release.
const PatchedFullWindowOverlay =
  FullWindowOverlay as unknown as ComponentType<PatchedFullWindowOverlayProps>;

export function OverlayContainer({
  children,
  bringToFrontToken,
}: IOverlayContainerProps) {
  return (
    <PatchedFullWindowOverlay bringToFrontToken={bringToFrontToken}>
      {children}
    </PatchedFullWindowOverlay>
  );
}
