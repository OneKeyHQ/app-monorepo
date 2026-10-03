import { cloneElement, isValidElement } from 'react';

import { TooltipText } from './TooltipText';

import type { ITooltipProps } from './type';
import type { IStackProps } from '../../primitives/Stack';

type IPressHandler = NonNullable<IStackProps['onPress']>;

// Native has no hover, so the tooltip is just its trigger. A parent such as
// Popover's Trigger still hands its press handler to this element (the web
// tooltip forwards it to the trigger wrapper), so pass it down to the trigger
// element or the tap never reaches the control underneath.
export function Tooltip({ renderTrigger, onPress }: ITooltipProps) {
  if (!onPress || !isValidElement<{ onPress?: IPressHandler }>(renderTrigger)) {
    return renderTrigger;
  }
  const triggerOnPress = renderTrigger.props.onPress;
  const handlePress: IPressHandler = (event) => {
    triggerOnPress?.(event);
    onPress(event);
  };
  return cloneElement(renderTrigger, { onPress: handlePress });
}

Tooltip.Text = TooltipText;

export * from './context';
export { closeAllTooltips } from './tooltipRegistry';
export * from './type';
