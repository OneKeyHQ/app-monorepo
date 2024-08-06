import type { TooltipProps as TMTooltipProps } from 'tamagui';

export interface ITooltipProps extends TMTooltipProps {
  renderTrigger: React.ReactNode;
  renderContent: React.ReactNode;
}
