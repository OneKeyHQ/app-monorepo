import { forwardRef } from 'react';

import { Anchor as TamaguiAnchor } from './Anchor';

import type { IAnchorProps as ITamaguiAnchorProps } from './Anchor';

export type IAnchorProps = ITamaguiAnchorProps;

export const Anchor = forwardRef<
  React.ElementRef<typeof TamaguiAnchor>,
  IAnchorProps
>(({ target = '_blank', ...props }, ref) => {
  return <TamaguiAnchor {...props} target={target} ref={ref} />;
});

Anchor.displayName = 'Anchor';
