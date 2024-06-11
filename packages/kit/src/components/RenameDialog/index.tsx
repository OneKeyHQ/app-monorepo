import { Dialog, Input, Toast } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

export const showRenameDialog = (
  name: string,
  {
    onSubmit,
    maxLength = 24,
    ...dialogProps
  }: IDialogShowProps & {
    maxLength?: number;
    onSubmit: (name: string) => Promise<void>;
  },
) =>
  Dialog.show({
    title: appLocale.intl.formatMessage({ id: ETranslations.global_rename }),
    renderContent: (
      <Dialog.Form formProps={{ values: { name } }}>
        <Dialog.FormField
          name="name"
          rules={{
            required: { value: true, message: 'Name is required.' },
          }}
        >
          <Input
            size="large"
            $gtMd={{ size: 'medium' }}
            maxLength={maxLength}
            autoFocus
          />
        </Dialog.FormField>
      </Dialog.Form>
    ),
    onConfirm: async ({ getForm, close }) => {
      const form = getForm();
      try {
        await onSubmit(form?.getValues().name);
        // fix toast dropped frames
        await close();
        Toast.success({
          title: appLocale.intl.formatMessage({
            id: ETranslations.feedback_change_saved,
          }),
        });
      } catch (error: unknown) {
        Toast.error({
          title: `Change Failed via ${(error as Error).message}`,
        });
        throw error;
      }
    },
    ...dialogProps,
  });
