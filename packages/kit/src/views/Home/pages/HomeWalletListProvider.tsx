import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

type IWalletListResult = Awaited<
  ReturnType<typeof backgroundApiProxy.serviceAccount.getWallets>
>;

type IHomeWalletListContext = {
  result: IWalletListResult | undefined;
  pending: boolean;
  refresh: () => Promise<void>;
};

const HomeWalletListContext = createContext<IHomeWalletListContext | undefined>(
  undefined,
);

export function HomeWalletListProvider({ children }: PropsWithChildren) {
  const requestTokenRef = useRef(0);
  const [result, setResult] = useState<IWalletListResult>();
  const [pending, setPending] = useState(true);

  const refresh = useCallback(async () => {
    requestTokenRef.current += 1;
    const requestToken = requestTokenRef.current;
    setPending(true);
    const fetchWallets = async (retryIndex = 0): Promise<void> => {
      if (requestToken !== requestTokenRef.current) {
        return;
      }
      try {
        const nextResult = await backgroundApiProxy.serviceAccount.getWallets({
          ignoreEmptySingletonWalletAccounts: true,
        });
        if (requestToken === requestTokenRef.current) {
          setResult(nextResult);
          setPending(false);
        }
      } catch (_error) {
        const retryDelays = [250, 500, 1000, 2000, 4000];
        await timerUtils.wait(
          retryDelays[Math.min(retryIndex, retryDelays.length - 1)],
        );
        await fetchWallets(retryIndex + 1);
      }
    };
    await fetchWallets();
  }, []);

  useEffect(() => {
    void refresh();
    const handleWalletListChange = () => {
      void refresh();
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, handleWalletListChange);
    appEventBus.on(EAppEventBusNames.AccountUpdate, handleWalletListChange);
    appEventBus.on(EAppEventBusNames.AccountRemove, handleWalletListChange);
    return () => {
      requestTokenRef.current += 1;
      appEventBus.off(EAppEventBusNames.WalletUpdate, handleWalletListChange);
      appEventBus.off(EAppEventBusNames.AccountUpdate, handleWalletListChange);
      appEventBus.off(EAppEventBusNames.AccountRemove, handleWalletListChange);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ result, pending, refresh }),
    [pending, refresh, result],
  );
  return (
    <HomeWalletListContext.Provider value={value}>
      {children}
    </HomeWalletListContext.Provider>
  );
}

export function useHomeWalletList() {
  const context = useContext(HomeWalletListContext);
  if (!context) {
    throw new OneKeyLocalError(
      'useHomeWalletList must be used inside HomeWalletListProvider',
    );
  }
  return context;
}
