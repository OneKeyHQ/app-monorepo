import type { IInputProps } from '@onekeyhq/components';
import { Dialog, Input } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

type IFormValues = { page?: number };

function DialogInput({
  testID,
  value,
  onChange,
  placeholder,
}: {
  testID?: string;
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: IInputProps['placeholder'];
}) {
  return (
    <Input
      size="large"
      testID={testID}
      $gtMd={{ size: 'medium' }}
      autoFocus
      selectTextOnFocus
      value={value}
      placeholder={placeholder}
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
      id: ETranslations.global_bulk_accounts_page_number,
    }),
    renderContent: (
      <Dialog.Form formProps={{ values: { page } }}>
        <Dialog.FormField
          name="page"
          rules={{
            required: true,
            // TODO how to get form in Dialog?
            // onChange: (e: { target: { name: string; value: string } }) => {
            //   const value = (e?.target?.value || '').replace(/\D/g, '');
            //   const valueNum = new BigNumber(parseInt(value, 10));
            //   if (!value || valueNum.isNaN()) {
            //     form.setValue('from', '');
            //     return;
            //   }
            //   if (valueNum.isLessThan(1)) {
            //     form.setValue('from', '1');
            //     return;
            //   }
            //   form.setValue('from', valueNum.toFixed());
            // },
          }}
        >
          <DialogInput
            testID="batch-create-account-preview-page-number-input"
            placeholder={String(page)}
          />
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
