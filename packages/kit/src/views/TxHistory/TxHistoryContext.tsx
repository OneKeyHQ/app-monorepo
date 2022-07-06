import React, { createContext, useContext, useState } from 'react';

export type ITxHistoryContextData = {
  refresh?: () => void;
  isLoading?: boolean;
  isHomeTab?: boolean;
  headerView?: JSX.Element | null;
};

export type ITxHistoryContext = {
  context: ITxHistoryContextData;
  setContext: React.Dispatch<React.SetStateAction<ITxHistoryContextData>>;
};

const TxHistoryContext = createContext<ITxHistoryContext | null>(null);

function TxHistoryContextProvider(
  props: ITxHistoryContextData & {
    children: JSX.Element;
  },
) {
  const { children, isHomeTab, headerView, refresh } = props;
  const [context, setContext] = useState<ITxHistoryContextData>({
    isLoading: false,
    isHomeTab,
    headerView,
    refresh,
  });
  return (
    <TxHistoryContext.Provider value={{ context, setContext }}>
      {children}
    </TxHistoryContext.Provider>
  );
}

function useTxHistoryContext() {
  return useContext(TxHistoryContext);
}

export { TxHistoryContextProvider, useTxHistoryContext };
