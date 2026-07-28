import { SizableText } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';

export function TooltipText({ children }: ISizableTextProps) {
  return <SizableText size="$bodySm">{children}</SizableText>;
}
