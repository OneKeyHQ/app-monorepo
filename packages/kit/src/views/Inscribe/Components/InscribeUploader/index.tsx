import { useState } from 'react';

import { useDropzone } from 'react-dropzone';
import { useIntl } from 'react-intl';

import {
  Center,
  Icon,
  Spinner,
  Text,
  ToastManager,
  useThemeValue,
} from '@onekeyhq/components';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  fileToBuffer,
  fileToDataUrl,
} from '../../../../utils/hardware/homescreens';
import { checkFileSize } from '../../CreateContent/util';
import { InscribeFilePreview } from '../InscribeFilePreview';

import type { Props } from './type';

function InscribeUploader(props: Props) {
  const { file: fileFromOut, setFileFromOut, setError } = props;
  const [uploaderBg, uploaderBorderColor, uploaderActiveBorderColor] =
    useThemeValue(['surface-default', 'border-default', 'interactive-default']);
  const [isLoading, setLoading] = useState(false);

  const intl = useIntl();

  const { isDragAccept, getRootProps, getInputProps } = useDropzone({
    multiple: false,
    accept: {
      'text/plain': ['.txt'],
      'image/png': ['.png', '.PNG'],
      'image/gif': ['.gif'],
      'image/jpeg': ['.jpeg', '.jpg'],
      'application/json': ['.json'],
      'audio/mpeg': ['.mp3'],
      'video/mp4': ['.mp4'],
      'image/webp': ['.webp'],
    },
    onDropAccepted: async (files) => {
      try {
        const file = files[0] as File;
        setFileFromOut(undefined);
        setError('');
        setLoading(true);

        const data = await fileToBuffer(file);
        if (data.length === 0) {
          ToastManager.show(
            {
              title: intl.formatMessage({
                id: 'msg__text_file_cannot_be_blank',
              }),
            },
            { type: 'error' },
          );
          setLoading(false);
          return;
        }
        if (!checkFileSize(data.length)) {
          setError(
            intl.formatMessage(
              { id: 'msg__file_size_should_less_than_str' },
              { 0: '380KB' },
            ),
          );
          if (!file.type.startsWith('image')) {
            setFileFromOut({
              dataForUI: '',
              dataForAPI: '',
              dataLength: data.length,
              name: file.name,
              size: file.size,
              type: file.type,
            });
            setLoading(false);
            return;
          }
        }
        const dataForUI = await fileToDataUrl(file);

        const dataForAPI = bufferUtils.bytesToHex(data);
        if (data) {
          setFileFromOut({
            dataForAPI,
            dataForUI,
            dataLength: data.length,
            name: file.name,
            size: file.size,
            type: file.type,
          });
          setLoading(false);
        }
      } catch (e) {
        setLoading(false);
        console.log('e = ', e);
      }
    },
    // onDropRejected() {
    // },
  });

  return (
    <div
      {...getRootProps()}
      style={{
        cursor: 'pointer',
        background: uploaderBg,
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: '12px',
        height: '148px',
        overflow: 'hidden',
        borderColor: isDragAccept
          ? uploaderActiveBorderColor
          : uploaderBorderColor,
      }}
    >
      <input {...getInputProps()} />
      {!fileFromOut ? (
        <Center w="full" h="full">
          {isLoading ? (
            <Spinner size="lg" />
          ) : (
            <>
              <Icon name="ArrowUpTrayOutline" size={36} />
              <Text fontSize={14} mt="20px">
                {intl.formatMessage({
                  id: 'form__drag_or_drop_file_to_import',
                })}
              </Text>
            </>
          )}
        </Center>
      ) : (
        <InscribeFilePreview file={fileFromOut} />
      )}
    </div>
  );
}

export { InscribeUploader };
