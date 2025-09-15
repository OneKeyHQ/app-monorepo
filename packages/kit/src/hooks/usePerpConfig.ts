import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

export const usePerpConfig = () => {
  const { result } = usePromiseResult(async () => {
    const config =
      await backgroundApiProxy.serviceWebviewPerp.getPerpCommonConfig();
    return config;
  }, []);
  return result;
};
