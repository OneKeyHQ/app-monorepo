import type { ComponentProps, FC } from 'react';
import { useCallback, useState } from 'react';

import { Popover as NBPopover } from 'native-base';

import type { ThemeToken } from '../Provider/theme';
import type { IPopoverProps } from 'native-base';

export type PopoverProps = {
  trigger: ({ ...props }) => JSX.Element;
  bgColor?: ThemeToken;
  position?: IPopoverProps['placement'] | 'auto';
  bodyProps?: ComponentProps<typeof NBPopover.Body>;
  contentProps?: ComponentProps<typeof NBPopover.Content>;
  arrowProps?: ComponentProps<typeof NBPopover.Arrow>;
};

const Popover: FC<PopoverProps> = ({
  trigger,
  bodyProps,
  bgColor = 'text-default',
  position = 'auto',
  contentProps,
  arrowProps,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const renderTigger = useCallback(
    (
      triggerProps,
      state: {
        open: boolean;
      },
    ) =>
      trigger({
        ...triggerProps,
        onPress: () => setIsOpen(!state.open),
      }),
    [trigger],
  );

  return (
    <NBPopover
      trigger={renderTigger}
      placement={position === 'auto' ? undefined : position}
      onClose={() => setIsOpen(!isOpen)}
      isOpen={isOpen}
    >
      <NBPopover.Content
        bgColor={bgColor}
        borderRadius="12px"
        {...contentProps}
      >
        <NBPopover.Arrow {...arrowProps} />
        <NBPopover.Body {...bodyProps} />
      </NBPopover.Content>
    </NBPopover>
  );
};
export default Popover;
