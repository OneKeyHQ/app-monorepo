import Popover from '../Popover';

import type { PopoverProps } from '../Popover';

export type RichTooltipProps = PopoverProps;

function RichTooltip(props: RichTooltipProps) {
  const {
    trigger,
    arrowProps,
    bodyProps,
    contentProps,
    position = 'top',
    bgColor = 'surface-default',
  } = props;

  return (
    <Popover
      position={position}
      trigger={trigger}
      bgColor={bgColor}
      arrowProps={{
        bgColor,
        borderColor: 'border-subdued',
        ...arrowProps,
      }}
      contentProps={{
        maxWidth: '260px',
        borderRadius: '6px',
        borderColor: 'border-subdued',
        ...contentProps,
      }}
      bodyProps={{
        bgColor,
        ...bodyProps,
      }}
    />
  );
}

export default RichTooltip;
