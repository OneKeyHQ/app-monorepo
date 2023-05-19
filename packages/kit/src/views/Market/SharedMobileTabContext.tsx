import { createContext } from 'react';

type EnableSwipeSharedMobileTabContext = (enable: boolean) => void;

export const SharedMobileTabContext =
  createContext<EnableSwipeSharedMobileTabContext>(() => {});
