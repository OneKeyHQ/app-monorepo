import { createPortal } from 'react-dom';

import { Portal } from '@onekeyhq/components';

export function PasswordVerifyPortalContainer() {
  return createPortal(
    <Portal.Container
      name={Portal.Constant.PASSWORD_VERIFY_CONTAINER_PORTAL}
    />,
    document.body,
  );
}
