import Popover from '../Popover';

import type { PopoverProps } from '../Popover';

export type RichTooltipProps = PopoverProps;

function RichTooltip(props: RichTooltipProps) {
  const {
    arrowProps,
    bodyProps,
    contentProps,
    position = 'top',
    bgColor = 'surface-default',
    ...popoverProps
  } = props;

  return (
    <Popover
      position={position}
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
      {...popoverProps}
    />
  );
}

export default RichTooltip;
