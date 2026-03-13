import type { PropsWithChildren } from 'react';

import { createPortal } from 'react-dom';

import { Portal } from '@onekeyhq/components';

export function AppStateContainer({ children }: PropsWithChildren) {
  return createPortal(
    <div>
      {children}
      <Portal.Container
        name={Portal.Constant.APP_STATE_LOCK_CONTAINER_OVERLAY}
      />
    </div>,
    document.body,
  );
}
