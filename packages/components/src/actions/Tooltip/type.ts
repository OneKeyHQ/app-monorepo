import type {
  PopoverContentProps,
  TooltipProps as TMTooltipProps,
} from '@onekeyhq/components/src/shared/tamagui';
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

export interface ITooltipRef {
  closeTooltip: () => Promise<void>;
  openTooltip: () => Promise<void>;
}

export interface ITooltipProps extends TMTooltipProps {
  renderTrigger: React.ReactNode;
  renderContent: React.ReactNode;
  shortcutKey?: EShortcutEvents | string[];
  hovering?: boolean;
  contentProps?: PopoverContentProps;
  ref?: React.RefObject<ITooltipRef>;
}
