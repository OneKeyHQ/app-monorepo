import { createContext, useContext } from 'react';

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
