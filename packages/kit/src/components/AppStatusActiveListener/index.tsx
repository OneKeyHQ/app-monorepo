import type { FC } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import type { IDesktopAppState } from '@onekeyhq/desktop/src-electron/preload';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IStatus = IDesktopAppState;

type IAppStatusActiveListenerProps = { onActive: () => void };

const DesktopStatusActiveListener: FC<IAppStatusActiveListenerProps> = ({
  onActive,
}) => {
  const appState = useRef<IStatus>();
  const onChange = useCallback(
    (nextState: IStatus) => {
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

const ExtStatusActiveListener: FC<IAppStatusActiveListenerProps> = ({
  onActive,
}) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(onActive, []);
  return null;
};

export const AppStatusActiveListener: FC<IAppStatusActiveListenerProps> = ({
  onActive,
}) => {
  if (platformEnv.isDesktop) {
    return <DesktopStatusActiveListener onActive={onActive} />;
  }
  if (platformEnv.isExtension) {
    return <ExtStatusActiveListener onActive={onActive} />;
  }
  return null;
};
