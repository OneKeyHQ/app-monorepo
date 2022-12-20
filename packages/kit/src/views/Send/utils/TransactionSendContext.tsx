import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/ban-types
export type ITransactionSendContextData = {};

export type ITransactionSendContext = {
  isTransactionSendFlow: boolean;
  context: ITransactionSendContextData;
  setContext: Dispatch<SetStateAction<ITransactionSendContextData>>;
};

const TransactionSendContext = createContext<ITransactionSendContext | null>(
  null,
);

function TransactionSendContextProvider(
  props: ITransactionSendContextData & {
    children: JSX.Element;
  },
) {
  const { children } = props;
  const [context, setContext] = useState<ITransactionSendContextData>({});

  // useEffect(() => {
  //   setContext((ctx) => ({
  //     ...ctx,
  //   }));
  // }, []);
  const contextValue = useMemo(
    () => ({
      isTransactionSendFlow: true,
      context,
      setContext,
    }),
    [context],
  );

  return (
    <TransactionSendContext.Provider value={contextValue}>
      {children}
    </TransactionSendContext.Provider>
  );
}

function useTransactionSendContext() {
  return useContext(TransactionSendContext);
}

export { TransactionSendContextProvider, useTransactionSendContext };
