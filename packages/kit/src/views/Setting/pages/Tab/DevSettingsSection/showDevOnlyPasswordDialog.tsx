import { Dialog, Input } from '@onekeyhq/components';
import type { IDialogButtonProps } from '@onekeyhq/components/src/composite/Dialog/type';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { isCorrectDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SettingTestIDs } from '../../../testIDs';
import {
  cacheDevOnlyPassword,
  clearCachedDevOnlyPassword,
  getCachedDevOnlyPassword,
} from '../../../utils/devOnlyPassword';

export function showDevOnlyPasswordDialog({
  title,
  description,
  onConfirm,
  confirmButtonProps,
  confirmText,
}: {
  title: string;
  description?: string;
  onConfirm: (params: IBackgroundMethodWithDevOnlyPassword) => Promise<void>;
  confirmButtonProps?: IDialogButtonProps;
  confirmText?: string;
}) {
  Dialog.show({
    title,
    description,
    onConfirmText: confirmText,
    confirmButtonProps: {
      variant: 'destructive',
      ...confirmButtonProps,
    },
    renderContent: (
      <Dialog.Form
        formProps={{ values: { password: getCachedDevOnlyPassword() } }}
      >
        <Dialog.FormField
          name="password"
          rules={{
            required: { value: true, message: 'password is required.' },
          }}
        >
          <Input
            testID={SettingTestIDs.devOnlyPassword}
            placeholder="devOnlyPassword"
          />
        </Dialog.FormField>
      </Dialog.Form>
    ),
    onConfirm: async ({ getForm }) => {
      const form = getForm();
      if (form) {
        await form.trigger();
        const { password } = (form.getValues() || {}) as {
          password: string;
        };
        if (!isCorrectDevOnlyPassword(password)) {
          clearCachedDevOnlyPassword(password);
          return;
        }
        cacheDevOnlyPassword(password);
        const params: IBackgroundMethodWithDevOnlyPassword = {
          $$devOnlyPassword: password,
        };
        await onConfirm(params);
      }
    },
  });
}
