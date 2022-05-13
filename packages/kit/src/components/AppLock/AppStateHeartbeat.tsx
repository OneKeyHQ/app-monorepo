import React, { useCallback, useEffect } from 'react';

import { AppState } from 'react-native';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useInterval } from '../../hooks';
import { refreshLastActivity } from '../../store/reducers/status';

export const AppStateHeartbeat = () => {
  const refresh = useCallback(() => {
    if (AppState.currentState === 'active') {
      backgroundApiProxy.dispatch(refreshLastActivity());
    }
  }, []);
  useInterval(refresh, 5 * 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);
  return <></>;
};
