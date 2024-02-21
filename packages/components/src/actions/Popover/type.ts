import type { PropsWithChildren } from 'react';

export interface IPopoverContent extends PropsWithChildren {
  closePopover: () => void;
}
