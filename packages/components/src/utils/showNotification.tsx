import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';

import InAppNotification from '../InAppNotification';

import type { InAppNotificationProps } from '../InAppNotification';

const DISMISS_TIMEOUT = 3000;

let queue = Promise.resolve();

export const showNotification = (props: InAppNotificationProps) =>
  (queue = queue.then(
    () =>
      new Promise<void>((resolve) => {
        showOverlay((onClose) => {
          const close = () => {
            onClose();
            resolve();
          };
          setTimeout(close, DISMISS_TIMEOUT);
          return <InAppNotification {...props} onClose={close} />;
        });
      }),
  ));
