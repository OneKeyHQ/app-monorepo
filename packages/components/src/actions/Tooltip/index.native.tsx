import { SizableText } from '../../primitives';

import type { ITooltipProps } from './type';
import type { ISizableTextProps } from '../../primitives';

export function TooltipText({ children }: ISizableTextProps) {
  return <SizableText size="$bodySm">{children}</SizableText>;
}

export function Tooltip({ renderTrigger }: ITooltipProps) {
  return renderTrigger;
}

Tooltip.Text = TooltipText;

export * from './type';
