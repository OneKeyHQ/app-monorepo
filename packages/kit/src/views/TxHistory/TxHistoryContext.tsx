import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useState,
} from 'react';

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
