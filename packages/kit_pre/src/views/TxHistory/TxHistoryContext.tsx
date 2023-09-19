import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

export type ITxHistoryContextData = {
  refresh?: () => void;
  isLoading?: boolean;
  isTab?: boolean;
  headerView?: JSX.Element | null;
};

export type ITxHistoryContext = {
  context: ITxHistoryContextData;
  setContext: Dispatch<SetStateAction<ITxHistoryContextData>>;
};

const TxHistoryContext = createContext<ITxHistoryContext | null>(null);

function TxHistoryContextProvider(
  props: ITxHistoryContextData & {
    children: JSX.Element;
  },
) {
  const { children, isLoading = false, isTab, headerView, refresh } = props;
  const [context, setContext] = useState<ITxHistoryContextData>({
    isLoading,
    isTab,
    headerView,
    refresh,
  });

  // useEffect(() => {
  //   setContext((ctx) => ({
  //     ...ctx,
  //     isLoading,
  //     isTab,
  //     headerView,
  //     refresh,
  //   }));
  // }, [isLoading, isTab, headerView, refresh]);

  const contextValue = useMemo(() => ({ context, setContext }), [context]);
  return (
    <TxHistoryContext.Provider value={contextValue}>
      {children}
    </TxHistoryContext.Provider>
  );
}

function useTxHistoryContext() {
  return useContext(TxHistoryContext);
}

export { TxHistoryContextProvider, useTxHistoryContext };
