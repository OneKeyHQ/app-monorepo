import { Dialog, Input } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';

export const showRenameDialog = (
  name: string,
  dialogProps?: IDialogShowProps,
) =>
  new Promise<string>((resolve) => {
    Dialog.show({
      title: 'Rename',
      renderContent: (
        <Dialog.Form formProps={{ values: { name } }}>
          <Dialog.FormField
            name="name"
            rules={{
              required: { value: true, message: 'Please fill the name' },
              maxLength: {
                value: 128,
                message: 'Name cannot exceed 128 characters',
              },
            }}
          >
            <Input size="large" $gtMd={{ size: 'medium' }} autoFocus />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      onConfirm: async ({ getForm, close }) => {
        const form = getForm();
        await close();
        resolve(form?.getValues().name);
      },
      ...dialogProps,
    });
  });
