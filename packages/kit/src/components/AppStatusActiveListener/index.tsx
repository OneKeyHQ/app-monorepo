import { FC, useCallback, useEffect, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

type Status = 'active' | 'background';

type AppStatusActiveListenerProps = { onActive: () => void };

const DesktopStatusActiveListener: FC<AppStatusActiveListenerProps> = ({
  onActive,
}) => {
  const appState = useRef<Status>();
  const onChange = useCallback(
    (nextState: Status) => {
      if (appState.current === 'background' && nextState === 'active') {
        onActive?.();
      }
      appState.current = nextState;
    },
    [onActive],
  );
  useEffect(() => window.desktopApi.onAppState(onChange), [onChange]);
  return null;
};

export const AppStatusActiveListener: FC<AppStatusActiveListenerProps> = ({
  onActive,
}) => {
  if (platformEnv.isDesktop) {
    return <DesktopStatusActiveListener onActive={onActive} />;
  }
  return null;
};
