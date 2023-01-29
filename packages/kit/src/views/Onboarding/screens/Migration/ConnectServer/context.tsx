import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

import { httpServerEnable } from '@onekeyhq/kit-bg/src/services/ServiceHTTP';

export type MigrateContextValue = {
  inputValue: string;
  serverAddress?: string;
  selectRange?: number;
};

export type IMigrateContext = {
  context: MigrateContextValue;
  setContext: Dispatch<SetStateAction<MigrateContextValue>>;
};

export const MigrateContext = createContext<IMigrateContext | null>(null);

function MigrateContextProvider(
  props: MigrateContextValue & {
    children: JSX.Element;
  },
) {
  const { children, inputValue, serverAddress } = props;
  const [context, setContext] = useState<MigrateContextValue>(() => {
    let selectRange = 0;
    if (inputValue && inputValue?.length > 0) {
      selectRange = 1;
    }
    if (!httpServerEnable()) {
      selectRange = 1;
    }
    return {
      inputValue,
      serverAddress,
      selectRange,
    };
  });

  const contextValue = useMemo(() => ({ context, setContext }), [context]);
  return (
    <MigrateContext.Provider value={contextValue}>
      {children}
    </MigrateContext.Provider>
  );
}

function useMigrateContext() {
  return useContext(MigrateContext);
}

export { MigrateContextProvider, useMigrateContext };
