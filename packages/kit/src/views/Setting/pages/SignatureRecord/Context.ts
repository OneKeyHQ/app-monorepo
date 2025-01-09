import { createContext } from 'react';

export const SignatureContext = createContext<{
  networkId?: string;
  setNetworkId?: (networkId: string) => void;
  searchContent?: string;
  setSearchContent?: (searchContent: string) => void;
}>({});
