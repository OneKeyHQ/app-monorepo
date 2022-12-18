import type { ReactElement } from 'react';
import { cloneElement } from 'react';

import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';

const DialogManager = {
  show: ({ render }: { render: ReactElement }) => {
    showOverlay((onClose) =>
      cloneElement(render, {
        onClose,
      }),
    );
  },
};

export default DialogManager;
