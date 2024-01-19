import { Dialog, Input, Toast } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';

export const showRenameDialog = (
  name: string,
  {
    onSubmit,
    ...dialogProps
  }: IDialogShowProps & {
    onSubmit: (name: string) => Promise<void>;
  },
) =>
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
      try {
        await onSubmit(form?.getValues().name);
        Toast.success({
          title: 'Change Saved',
        });
      } catch (error) {
        Toast.error({
          title: 'Change Failed',
        });
      }
    },
    ...dialogProps,
  });
