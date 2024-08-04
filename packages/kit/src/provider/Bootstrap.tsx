import { useEffect } from 'react';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export function Bootstrap() {
  useEffect(() => {
    void backgroundApiProxy.serviceSetting.fetchCurrencyList();
  }, []);
  return null;
}
