import type { FC } from 'react';

import { useAppStateChange } from '@onekeyhq/kit/src/hooks/useAppStateChange';

type IAppStatusActiveListenerProps = { onActive: () => void };

export const AppStatusActiveListener: FC<IAppStatusActiveListenerProps> = ({
  onActive,
}) => {
  useAppStateChange(onActive);
  return null;
};
