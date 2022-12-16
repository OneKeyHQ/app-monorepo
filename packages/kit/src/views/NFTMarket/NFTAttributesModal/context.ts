import { Dispatch, SetStateAction, createContext, useContext } from 'react';

export type NFTAttributesContextValue = {
  selectedAttributes: Record<string, string[] | undefined>;
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
