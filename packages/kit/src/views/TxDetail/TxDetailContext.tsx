import React, { createContext, useContext, useEffect, useState } from 'react';

import { useSendConfirmRouteParamsParsed } from '../Send/utils/useSendConfirmRouteParamsParsed';

export type ITxDetailContextData = {
  isSendConfirm?: boolean;
  isHistoryDetail?: boolean;
  isMultipleActions?: boolean;
  sendConfirmParamsParsed?: ReturnType<typeof useSendConfirmRouteParamsParsed>;
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
  const {
    children,
    isHistoryDetail,
    isMultipleActions,
    isSendConfirm,
    sendConfirmParamsParsed,
  } = props;
  const [context, setContext] = useState<ITxDetailContextData>({
    isHistoryDetail,
    isMultipleActions,
    isSendConfirm,
    sendConfirmParamsParsed,
  });
  useEffect(() => {
    setContext((ctx) => ({
      ...ctx,
      isHistoryDetail,
      isMultipleActions,
      isSendConfirm,
      sendConfirmParamsParsed,
    }));
  }, [
    isHistoryDetail,
    isMultipleActions,
    isSendConfirm,
    sendConfirmParamsParsed,
  ]);
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
