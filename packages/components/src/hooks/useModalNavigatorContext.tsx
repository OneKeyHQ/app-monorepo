import { createContext, useContext } from 'react';

import type { EPortalContainerConstantName } from '../hocs/Portal';

export type IModalNavigatorContextType = {
  portalId: string;
};

export const createPortalId = () => Math.random().toString();

export const ModalNavigatorContext = createContext<IModalNavigatorContextType>(
  {} as IModalNavigatorContextType,
);

export const useModalNavigatorContextPortalId = () => {
  const pageTypeContext = useContext(ModalNavigatorContext);
  return (pageTypeContext.portalId || '') as EPortalContainerConstantName;
};
