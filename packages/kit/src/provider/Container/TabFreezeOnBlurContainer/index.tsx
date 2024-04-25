import { createContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

type ITabFreezeOnBlurContextValue = {
  freezeOnBlur: boolean;
  setFreezeOnBlur: (value: boolean) => void;
};

export const TabFreezeOnBlurContext =
  createContext<ITabFreezeOnBlurContextValue>({
    freezeOnBlur: true,
    setFreezeOnBlur: () => {},
  });

export const TabFreezeOnBlurContainer = ({ children }: PropsWithChildren) => {
  const [freezeOnBlur, setFreezeOnBlur] = useState(true);
  const value = useMemo(
    () => ({ freezeOnBlur, setFreezeOnBlur }),
    [freezeOnBlur, setFreezeOnBlur],
  );
  return (
    <TabFreezeOnBlurContext.Provider value={value}>
      {children}
    </TabFreezeOnBlurContext.Provider>
  );
};
