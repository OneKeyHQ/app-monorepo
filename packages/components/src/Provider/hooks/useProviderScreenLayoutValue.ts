import { createContext, useContext } from 'react';

export type ContextScreenLayoutValue = {
  isVerticalLayout: boolean;
};

export const ContextScreenLayout = createContext<ContextScreenLayoutValue>(
  {} as ContextScreenLayoutValue,
);

const useProviderScreenLayoutValue = () => useContext(ContextScreenLayout);
export default useProviderScreenLayoutValue;
