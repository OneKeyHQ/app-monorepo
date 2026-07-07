import { TooltipText } from './TooltipText';

import type { ITooltipProps } from './type';

export function Tooltip({ renderTrigger }: ITooltipProps) {
  return renderTrigger;
}

Tooltip.Text = TooltipText;

export * from './context';
export * from './type';
