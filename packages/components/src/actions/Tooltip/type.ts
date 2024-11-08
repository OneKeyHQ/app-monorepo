import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import type { TooltipProps as TMTooltipProps } from 'tamagui';

export interface ITooltipProps extends TMTooltipProps {
  renderTrigger: React.ReactNode;
  renderContent: React.ReactNode;
  shortcutKey?: EShortcutEvents | string[];
}
