import { createRef, forwardRef, useImperativeHandle, useState } from 'react';

import type { IInputProps } from '@onekeyhq/components';
import { Dialog, Input } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

type IFormValues = { page?: number };

type IPreviewPageNumberDialogContentRef = {
  getValues: () => IFormValues | undefined;
};

const PREVIEW_PAGE_NUMBER_DIALOG_ESTIMATED_CONTENT_HEIGHT = 44;

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

const PreviewPageNumberDialogContent = forwardRef<
  IPreviewPageNumberDialogContentRef,
  {
    page: number;
  }
>(function PreviewPageNumberDialogContent({ page }, ref) {
  const [value, setValue] = useState(String(page));

  useImperativeHandle(
    ref,
    () => ({
      getValues: () => {
        const pageNumber = Number.parseInt(value, 10);
        if (Number.isNaN(pageNumber)) {
          return undefined;
        }
        return {
          page: Math.max(1, pageNumber),
        };
      },
    }),
    [value],
  );

  return (
    <DialogInput
      testID="batch-create-account-preview-page-number-input"
      value={value}
      onChange={setValue}
      placeholder={String(page)}
    />
  );
});

export function showBatchCreateAccountPreviewPageNumberDialog({
  page,
  onSubmit,
  ...dialogProps
}: IDialogShowProps & {
  page: number;
  onSubmit: (values: IFormValues | undefined) => Promise<void>;
}) {
  const contentRef = createRef<IPreviewPageNumberDialogContentRef>();

  Dialog.show({
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_bulk_accounts_page_number,
    }),
    renderContent: (
      <PreviewPageNumberDialogContent ref={contentRef} page={page} />
    ),

    onConfirm: async ({ close, preventClose }) => {
      const values = contentRef.current?.getValues();
      if (!values) {
        preventClose();
        return;
      }
      await onSubmit(values);
      // fix toast dropped frames
      await close();
    },
    ...dialogProps,
    estimatedContentHeight:
      dialogProps.estimatedContentHeight ??
      PREVIEW_PAGE_NUMBER_DIALOG_ESTIMATED_CONTENT_HEIGHT,
  });
}
