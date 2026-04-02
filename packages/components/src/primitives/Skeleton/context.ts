import { createContext, useContext } from 'react';

export const SkeletonProvider = createContext<{
  isLoading: boolean | undefined;
}>({
  isLoading: undefined,
});

export const useIsGroupLoading = () => {
  const { isLoading } = useContext(SkeletonProvider);
  return isLoading;
};
