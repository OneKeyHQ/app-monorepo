import React, { createContext, useContext, useEffect, useState } from 'react';

export type ITxDetailContextData = {
  isSendConfirm?: boolean;
  isHistoryDetail?: boolean;
  isMultipleActions?: boolean;
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
  const { children, isHistoryDetail, isMultipleActions, isSendConfirm } = props;
  const [context, setContext] = useState<ITxDetailContextData>({
    isHistoryDetail,
    isMultipleActions,
    isSendConfirm,
  });
  useEffect(() => {
    setContext((ctx) => ({
      ...ctx,
      isHistoryDetail,
      isMultipleActions,
      isSendConfirm,
    }));
  }, [isHistoryDetail, isMultipleActions, isSendConfirm]);
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
