import type { TooltipProps as TMTooltipProps } from '@onekeyhq/components/src/shared/tamagui';
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

export interface ITooltipProps extends TMTooltipProps {
  renderTrigger: React.ReactNode;
  renderContent: React.ReactNode;
  shortcutKey?: EShortcutEvents | string[];
}
