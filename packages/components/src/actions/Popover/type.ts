import type { PropsWithChildren } from 'react';

import type { IPopoverProps } from '../..';
import type { IIconButtonProps } from '../IconButton';

export interface IPopoverContent extends PropsWithChildren {
  isOpen?: boolean;
  closePopover: () => void;
}

export interface IPopoverTooltip {
  tooltip?: string;
  title: string;
  placement?: IPopoverProps['placement'];
  renderContent?: IPopoverProps['renderContent'];
  triggerProps?: Partial<IIconButtonProps>;
}
