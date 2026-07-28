// Keep overlay primitives out of the shared Tamagui barrel so non-overlay
// components do not pull floating-ui into Web startup.
export { Popover as TMPopover } from '@tamagui/popover';
export type {
  PopoverContentProps,
  PopoverProps as TMPopoverProps,
} from '@tamagui/popover';

export { Tooltip as TMTooltip } from '@tamagui/tooltip';
export type { TooltipProps } from '@tamagui/tooltip';
