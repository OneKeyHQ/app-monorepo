import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext } from 'react';

export type NFTAttributesContextValue = {
  clearFlag: number;
  setIsDisabled?: (isDisabled: boolean) => void;
};

export type INFTAttributesContent = {
  context: NFTAttributesContextValue;
  setContext: Dispatch<SetStateAction<NFTAttributesContextValue>>;
};

export const NFTAttributesContext = createContext<INFTAttributesContent | null>(
  null,
);

export function useNFTAttributesContext() {
  return useContext(NFTAttributesContext);
}
