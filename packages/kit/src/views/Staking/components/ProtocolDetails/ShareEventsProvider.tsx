import { createContext, useContext } from 'react';

export const ShareEventsContext = createContext<{
  onHistory?: (params?: { filterType?: string }) => void;
}>({});

export const useShareEvents = () => {
  return useContext(ShareEventsContext);
};
