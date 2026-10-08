// Keep overlay primitives out of the shared Tamagui barrel so non-overlay
// components do not pull floating-ui into Web startup.
import { withStaticProperties } from '@tamagui/core';
import { Popover } from '@tamagui/popover';
import { Sheet } from '@tamagui/sheet';

export const TMPopover = withStaticProperties(Popover, { Sheet });
export type {
  PopoverContentProps,
  PopoverProps as TMPopoverProps,
} from '@tamagui/popover';

export { Tooltip as TMTooltip } from '@tamagui/tooltip';
export type { TooltipProps } from '@tamagui/tooltip';
