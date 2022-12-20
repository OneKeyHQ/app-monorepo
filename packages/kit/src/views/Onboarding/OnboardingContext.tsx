import type { Dispatch, SetStateAction } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useOnboardingLayoutVisible } from './hooks';

// eslint-disable-next-line @typescript-eslint/ban-types
export type IOnboardingContextData = {};

export type IOnboardingContext = {
  context: IOnboardingContextData;
  setContext: Dispatch<SetStateAction<IOnboardingContextData>>;
  visible: boolean;
  forceVisibleUnfocused: () => void; // keep screen visible when router unfocused
};

const OnboardingContext = createContext<IOnboardingContext | null>(null);

function OnboardingContextProvider(
  props: IOnboardingContextData & {
    children: JSX.Element;
  },
) {
  const { children } = props;
  const [context, setContext] = useState<IOnboardingContextData>({});
  const { visible, customVisibleRef } = useOnboardingLayoutVisible();
  const forceVisibleUnfocused = useCallback(() => {
    customVisibleRef.current = true;
  }, [customVisibleRef]);

  // useEffect(() => {
  //   setContext((ctx) => ({
  //     ...ctx,
  //   }));
  // }, []);

  const contextValue = useMemo(
    () => ({ context, setContext, visible, forceVisibleUnfocused }),
    [context, forceVisibleUnfocused, visible],
  );
  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}

function useOnboardingContext() {
  return useContext(OnboardingContext);
}

// TODO rename OnboardingLayoutContext
export { OnboardingContextProvider, useOnboardingContext };
