import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';

import InAppNotification from '../InAppNotification';

import type { InAppNotificationProps } from '../InAppNotification';

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
          return <InAppNotification {...props} onClose={close} />;
        });
      }),
  ));
