import { Tooltip as TMTooltip } from 'tamagui';

import { Text } from '../Text';

import type { TooltipProps as TMTooltipProps } from 'tamagui';

interface TooltipProps extends TMTooltipProps {
  renderTrigger: React.ReactNode;
  renderContent: React.ReactNode;
}

const transformOriginMap: Record<
  NonNullable<TooltipProps['placement']>,
  string
> = {
  'top': 'bottom center',
  'bottom': 'top center',
  'left': 'right center',
  'right': 'left center',
  'top-start': 'bottom left',
  'top-end': 'bottom right',
  'right-start': 'top left',
  'right-end': 'bottom left',
  'bottom-start': 'top left',
  'bottom-end': 'top left',
  'left-start': 'top right',
  'left-end': 'bottom right',
};

export function Tooltip({
  renderTrigger,
  renderContent,
  placement = 'bottom',
  ...props
}: TooltipProps) {
  const transformOrigin = transformOriginMap[placement] || 'bottom center';

  return (
    <TMTooltip
      unstyled
      delay={0}
      offset={6}
      allowFlip
      placement={placement}
      {...props}
    >
      <TMTooltip.Trigger>{renderTrigger}</TMTooltip.Trigger>
      <TMTooltip.Content
        unstyled
        maxWidth="$72"
        bg="$bg"
        borderRadius="$2"
        py="$2"
        px="$3"
        outlineWidth="$px"
        outlineStyle="solid"
        outlineColor="$neutral3"
        elevation={10}
        style={{
          transformOrigin,
        }}
        enterStyle={{
          scale: 0.95,
          opacity: 0,
        }}
        exitStyle={{ scale: 0.95, opacity: 0 }}
        animation="quick"
      >
        <Text variant="$bodySm">{renderContent}</Text>
      </TMTooltip.Content>
    </TMTooltip>
  );
}
