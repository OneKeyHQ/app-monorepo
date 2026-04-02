import { createContext, useContext } from 'react';

import type { EPortalContainerConstantName } from '../hocs/Portal';

export type IModalNavigatorContextType = {
  portalId: string;
};

export const createPortalId = () => Math.random().toString();

export const ModalNavigatorContext = createContext<IModalNavigatorContextType>(
  {} as IModalNavigatorContextType,
);
export const useModalNavigatorContext = () => {
  return useContext(ModalNavigatorContext);
};
export const useModalNavigatorContextPortalId = () => {
  const pageTypeContext = useModalNavigatorContext();
  return (pageTypeContext.portalId || '') as EPortalContainerConstantName;
};
