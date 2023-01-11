import { useState } from 'react';

import { useDropzone } from 'react-dropzone';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  Text,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';

function ReceiverUploader() {
  const [uploaderBg, uploaderBorderColor, uploaderActiveBorderColor] =
    useThemeValue(['surface-default', 'border-default', 'interactive-default']);

  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const {
    acceptedFiles,
    isDragActive,
    isFocused,
    getRootProps,
    getInputProps,
  } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
    },
  });

  console.log(isDragActive);

  return (
    <>
      <div
        {...getRootProps()}
        style={{
          cursor: 'pointer',
          background: uploaderBg,
          borderWidth: 1,
          borderStyle: 'solid',
          borderRadius: '12px',
          height: '148px',
          borderColor: isDragActive
            ? uploaderActiveBorderColor
            : uploaderBorderColor,
        }}
      >
        <input {...getInputProps()} />
        <Center w="full" h="full">
          <Icon name="UploadOutline" size={40} color="icon-subdued" />
          <Text fontSize={14} mt="20px">
            {intl.formatMessage({ id: 'form__drag_or_drop_file_to_import' })}
          </Text>
        </Center>
      </div>
      <Text fontSize={14} color="text-subdued" mt={isVertical ? 4 : 3}>
        {intl.formatMessage({ id: 'content__support_csv_txt_or_excel' })}
      </Text>
      <Text fontSize={12} color="text-subdued" mt={isVertical ? 4 : 3}>
        {intl.formatMessage({
          id: 'form__each_line_should_include_the_address_and_the_amount_seperated_by_commas',
        })}
      </Text>
    </>
  );
}

export { ReceiverUploader };
