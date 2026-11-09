import { createContext, useContext } from 'react';

export type IRegisterScrollContent = (
  element: HTMLElement,
  explicitHeight?: number,
) => () => void;

export const ScrollContentRegistrationContext = createContext<
  IRegisterScrollContent | undefined
>(undefined);

export function useScrollContentRegistration() {
  return useContext(ScrollContentRegistrationContext);
}
