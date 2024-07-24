import { Dialog, Input, SizableText } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

type IFormValues = { page?: number };

function DialogInput({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (val: string) => void;
}) {
  return (
    <Input
      size="large"
      $gtMd={{ size: 'medium' }}
      autoFocus
      selectTextOnFocus
      value={value}
      onChangeText={onChange}
    />
  );
}

export function showBatchCreateAccountPreviewPageNumberDialog({
  page,
  onSubmit,
  ...dialogProps
}: IDialogShowProps & {
  page: number;
  onSubmit: (values: IFormValues | undefined) => Promise<void>;
}) {
  Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslationsMock.batch_create_page_number_title,
    }),
    renderContent: (
      <Dialog.Form formProps={{ values: { page } }}>
        <Dialog.FormField
          name="page"
          rules={{
            required: {
              value: true,
              message: appLocale.intl.formatMessage({
                id: ETranslationsMock.batch_create_page_number_required,
              }),
            },
          }}
        >
          <DialogInput />
        </Dialog.FormField>
      </Dialog.Form>
    ),
    onConfirm: async ({ getForm, close }) => {
      const form = getForm();
      await onSubmit(form?.getValues());
      // fix toast dropped frames
      await close();
    },
    ...dialogProps,
  });
}
