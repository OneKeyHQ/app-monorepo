import { createContext, useContext } from 'react';

export type NFTAttributesContextValue = {
  selectedAttributes: Record<string, string[] | undefined>;
};

export type INFTAttributesContent = {
  context: NFTAttributesContextValue;
  setContext: React.Dispatch<React.SetStateAction<NFTAttributesContextValue>>;
};

export const NFTAttributesContext = createContext<INFTAttributesContent | null>(
  null,
);

export function useNFTAttributesContext() {
  return useContext(NFTAttributesContext);
}
