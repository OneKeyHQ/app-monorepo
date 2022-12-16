import { ComponentProps, FC, useCallback, useState } from 'react';

import { IPopoverProps, Popover as NBPopover } from 'native-base';

import { ThemeToken } from '../Provider/theme';

export type PopoverProps = {
  trigger: ({ ...props }) => JSX.Element;
  bgColor?: ThemeToken;
  position?: IPopoverProps['placement'] | 'auto';
  bodyProps?: ComponentProps<typeof NBPopover.Body>;
  contentProps?: ComponentProps<typeof NBPopover.Content>;
};

const Popover: FC<PopoverProps> = ({
  trigger,
  bodyProps,
  bgColor = 'text-default',
  position = 'auto',
  contentProps,
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
        <NBPopover.Arrow />
        <NBPopover.Body {...bodyProps} />
      </NBPopover.Content>
    </NBPopover>
  );
};
export default Popover;
