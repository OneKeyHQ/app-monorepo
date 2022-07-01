import React, { createContext, useContext, useState } from 'react';

export type ITxDetailContextData = {
  refresh?: () => void;
  isLoading?: boolean;
  isHomeTab?: boolean;
  headerView?: JSX.Element | null;
};

export type ITxDetailContext = {
  context: ITxDetailContextData;
  setContext: React.Dispatch<React.SetStateAction<ITxDetailContextData>>;
};

const TxDetailContext = createContext<ITxDetailContext | null>(null);

function TxDetailContextProvider(
  props: ITxDetailContextData & {
    children: JSX.Element;
  },
) {
  const { children, isHomeTab, headerView, refresh } = props;
  const [context, setContext] = useState<ITxDetailContextData>({
    isLoading: false,
    isHomeTab,
    headerView,
    refresh,
  });
  return (
    <TxDetailContext.Provider value={{ context, setContext }}>
      {children}
    </TxDetailContext.Provider>
  );
}

function useTxDetailContext() {
  return useContext(TxDetailContext);
}

export { TxDetailContextProvider, useTxDetailContext };
