import type { PropsWithChildren } from 'react';

import type { IPopoverProps } from '../..';

export interface IPopoverContent extends PropsWithChildren {
  isOpen?: boolean;
  closePopover: () => void;
}

export interface IPopoverTooltip {
  tooltip: string;
  title: string;
  placement?: IPopoverProps['placement'];
}
