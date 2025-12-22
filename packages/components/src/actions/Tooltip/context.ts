import { createContext, useContext } from 'react';

interface ITooltipContext {
  closeTooltip: () => Promise<void>;
}
export const TooltipContext = createContext<ITooltipContext>({
  closeTooltip: () => Promise.resolve(),
});

export function useTooltipContext() {
  return useContext(TooltipContext);
}
