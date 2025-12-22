import { createContext, useContext } from 'react';

interface ITooltipContext {
  closeTooltip: () => void;
}
export const TooltipContext = createContext<ITooltipContext>({
  closeTooltip: () => {},
});

export function useTooltipContext() {
  return useContext(TooltipContext);
}
