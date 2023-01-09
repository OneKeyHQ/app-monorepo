import { useState } from 'react';

import { useDropzone } from 'react-dropzone';
import { useIntl } from 'react-intl';

import { Box, Center, Icon, Text } from '@onekeyhq/components';

function InputUploader() {
  const intl = useIntl();
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

  return (
    <>
      <div
        {...getRootProps({ className: 'dropzone' })}
        borderWidth={1}
        borderRadius={12}
        height="148px"
        borderColor={
          isDragActive || isFocused ? 'interactive-default' : 'border-default'
        }
        backgroundColor="action-secondary-default"
      >
        <input {...getInputProps()} />
        <Center w="full" h="full">
          <Icon name="UploadOutline" size={40} color="icon-subdued" />
          <Text fontSize={14} mt="20px">
            {intl.formatMessage({ id: 'form__drag_or_drop_file_to_import' })}
          </Text>
        </Center>
      </div>
      <Text fontSize={14} color="text-subdued" mt={4}>
        {intl.formatMessage({ id: 'content__support_csv_txt_or_excel' })}
      </Text>
    </>
  );
}

export { InputUploader };
