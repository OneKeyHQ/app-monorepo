import { createContext, useCallback, useEffect, useState } from 'react';
import type { FC } from 'react';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { AppStatusActiveListener } from '../components/AppStatusActiveListener';

type ITranslationContext = Record<string, Record<string, string>>;

export const TranslationContext = createContext<ITranslationContext>({});

export const TranslationProvider: FC = ({ children }) => {
  const [state, setState] = useState({});
  const onActive = useCallback(async () => {
    const data = await backgroundApiProxy.serviceTranslation.getAll();
    if (data) {
      setState(data);
    }
  }, []);
  useEffect(() => {
    onActive();
  }, []);
  return (
    <>
      <AppStatusActiveListener onActive={onActive} />
      <TranslationContext.Provider value={state}>
        {children}
      </TranslationContext.Provider>
    </>
  );
};
