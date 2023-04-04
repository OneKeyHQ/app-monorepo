import type { ReactElement } from 'react';
import { cloneElement } from 'react';

import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';

// Because dialogs are wrapped in RN Modal
// so there are 3 ways to use dialog in overlay:
// 1. showDialog(<Dialog />)
// 2. showOverlay((onClose) => <Dialog onClose={onClose} />, true)
// 3. DialogManager.show({ render: <Dialog />})
const DialogManager = {
  show: ({ render }: { render: ReactElement }) => {
    showOverlay(
      (onClose) =>
        cloneElement(render, {
          onClose,
        }),
      true,
    );
  },
};

export default DialogManager;
