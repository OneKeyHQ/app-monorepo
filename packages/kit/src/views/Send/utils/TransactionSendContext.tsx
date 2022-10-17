import React, { createContext, useContext, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/ban-types
export type ITransactionSendContextData = {};

export type ITransactionSendContext = {
  isTransactionSendFlow: boolean;
  context: ITransactionSendContextData;
  setContext: React.Dispatch<React.SetStateAction<ITransactionSendContextData>>;
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

  return (
    <TransactionSendContext.Provider
      value={{
        isTransactionSendFlow: true,
        context,
        setContext,
      }}
    >
      {children}
    </TransactionSendContext.Provider>
  );
}

function useTransactionSendContext() {
  return useContext(TransactionSendContext);
}

export { TransactionSendContextProvider, useTransactionSendContext };
