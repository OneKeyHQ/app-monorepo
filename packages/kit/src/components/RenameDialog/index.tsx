import { Dialog, Input, Toast } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';

export const showRenameDialog = (
  name: string,
  {
    onSubmit,
    onCheckRepeat,
    ...dialogProps
  }: IDialogShowProps & {
    onSubmit: (name: string) => Promise<void>;
    onCheckRepeat?: (name: string) => Promise<boolean>;
  },
) =>
  Dialog.show({
    title: 'Rename',
    renderContent: (
      <Dialog.Form formProps={{ values: { name } }}>
        <Dialog.FormField
          name="name"
          rules={{
            required: { value: true, message: 'Name is required.' },
            validate: async (value) => {
              if (onCheckRepeat && (await onCheckRepeat(value))) {
                return 'The name already exists.';
              }
            },
          }}
        >
          <Input
            size="large"
            $gtMd={{ size: 'medium' }}
            autoFocus
            onChangeText={(v: string) => (v.length > 24 ? v.slice(0, 24) : v)}
          />
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
