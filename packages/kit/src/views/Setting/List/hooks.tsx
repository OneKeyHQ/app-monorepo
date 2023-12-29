import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import PasswordSetupContainer from '@onekeyhq/kit/src/components/Password/container/PasswordSetupContainer';

export const useSetPasswordCallback = () => {
  const intl = useIntl();
  return useCallback(
    (cb?: () => void) => {
      const dialog = Dialog.show({
        title: intl.formatMessage({ id: 'title__set_password' }),
        renderContent: (
          <PasswordSetupContainer
            onSetupRes={async (data) => {
              if (data) {
                await dialog.close();
                cb?.();
              }
            }}
          />
        ),
        showFooter: false,
      });
    },
    [intl],
  );
};
