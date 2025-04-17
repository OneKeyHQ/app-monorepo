import { forwardRef } from 'react';

import { Anchor as TamaguiAnchor } from 'tamagui';

import type { AnchorProps } from 'tamagui';

export type IAnchorProps = AnchorProps;

export const Anchor = forwardRef<
  React.ElementRef<typeof TamaguiAnchor>,
  IAnchorProps
>(({ target = '_blank', ...props }, ref) => {
  return <TamaguiAnchor {...props} target={target} ref={ref} />;
});

Anchor.displayName = 'Anchor';
