import type {
  PopoverContentProps,
  TooltipProps as TMTooltipProps,
} from '@onekeyhq/components/src/shared/tamaguiOverlay';
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import type { IStackProps } from '../../primitives/Stack';

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
  disabled?: boolean;
  onPress?: IStackProps['onPress'];
  triggerAsChild?: boolean | 'except-style';
  ref?: React.RefObject<ITooltipRef>;
}
