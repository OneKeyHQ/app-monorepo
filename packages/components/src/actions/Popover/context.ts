import { createContext, useContext } from 'react';

import type { IDialogShowProps } from '../../composite/Dialog/type';

export const NativePopoverPresentationContext = createContext<
  Pick<IDialogShowProps, 'portalContainer' | 'nativeDrawer'> | undefined
>(undefined);

interface IPopoverContext {
  open?: boolean;
  closePopover?: () => Promise<void>;
}

export const PopoverContext = createContext({} as IPopoverContext);

export const usePopoverContext = () => {
  const { closePopover, open } = useContext(PopoverContext);
  return {
    open,
    closePopover,
  };
};
