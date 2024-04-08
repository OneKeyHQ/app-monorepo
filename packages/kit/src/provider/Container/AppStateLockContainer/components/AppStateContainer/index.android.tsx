import type { PropsWithChildren } from 'react';

import { Portal } from '@onekeyhq/components';

export function AppStateContainer({ children }: PropsWithChildren) {
  console.log('AppStateContainer');
  return (
    <>
      {children}
      <Portal.Container
        name={Portal.Constant.APP_STATE_LOCK_CONTAINER_OVERLAY}
      />
    </>
  );
}
