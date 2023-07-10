import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { useSendConfirmRouteParamsParsed } from '../Send/utils/useSendConfirmRouteParamsParsed';

export type ITxDetailContextData = {
  isSendConfirm?: boolean;
  isBatchSendConfirm?: boolean;
  isHistoryDetail?: boolean;
  isMultipleActions?: boolean;
  sendConfirmParamsParsed?: ReturnType<typeof useSendConfirmRouteParamsParsed>;
  isCollapse?: boolean;
};

export type ITxDetailContext = {
  context: ITxDetailContextData;
  setContext: Dispatch<SetStateAction<ITxDetailContextData>>;
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
    isCollapse,
  } = props;
  const [context, setContext] = useState<ITxDetailContextData>({
    isHistoryDetail,
    isMultipleActions,
    isSendConfirm,
    sendConfirmParamsParsed,
    isCollapse,
  });
  useEffect(() => {
    setContext((ctx) => ({
      ...ctx,
      isHistoryDetail,
      isMultipleActions,
      isSendConfirm,
      sendConfirmParamsParsed,
      isCollapse,
    }));
  }, [
    isHistoryDetail,
    isMultipleActions,
    isSendConfirm,
    sendConfirmParamsParsed,
    isCollapse,
  ]);

  const contextValue = useMemo(() => ({ context, setContext }), [context]);
  return (
    <TxDetailContext.Provider value={contextValue}>
      {children}
    </TxDetailContext.Provider>
  );
}

function useTxDetailContext() {
  return useContext(TxDetailContext);
}

export { TxDetailContextProvider, useTxDetailContext };
