import { useDropzone } from 'react-dropzone';
import { useIntl } from 'react-intl';

import { Center, Icon, Text, useThemeValue } from '@onekeyhq/components';

import { fileToBuffer, fileToDataUrl } from '../../../../utils/hardware/homescreens';
import { InscribeFilePreview } from '../InscribeFilePreview';

import type { Props } from './type';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

function InscribeUploader(props: Props) {
  const { file: fileFromOut, setFileFromOut } = props;
  const [uploaderBg, uploaderBorderColor, uploaderActiveBorderColor] =
    useThemeValue(['surface-default', 'border-default', 'interactive-default']);

  const intl = useIntl();

  const { isDragAccept, getRootProps, getInputProps } = useDropzone({
    multiple: false,
    accept: {
      'text/plain': ['.txt'],
      'image/png': ['.png', '.PNG'],
      // 'image/gif': ['.gif'],
      'image/jpeg': ['.jpeg', '.jpg'],
      'application/json': ['.json'],
      // 'audio/mpeg': ['.mp3'],
      // 'video/mp4': ['.mp4'],
      // 'image/webp': ['.webp'],
    },
    onDropAccepted: async (files) => {
      try {
        const file = files[0] as File;
        // const data = await RNFS.readFile(file., 'base64');

        const data = await fileToBuffer(file);
        const dataHex = bufferUtils.bytesToHex(data);
        if (data) {
          setFileFromOut({
            data: dataHex,
            dataLength: data.length,
            name: file.name,
            size: file.size,
            type: file.type,
          });
        }
      } catch (e) {
        console.log('e = ', e);
      }
    },
    // onDropRejected() {
    // },
  });

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
          overflow: 'hidden',
          borderColor: isDragAccept
            ? uploaderActiveBorderColor
            : uploaderBorderColor,
        }}
      >
        <input {...getInputProps()} />

        {!fileFromOut ? (
          <Center w="full" h="full">
            <Icon name="ArrowUpTrayOutline" size={36} />
            <Text fontSize={14} mt="20px">
              {intl.formatMessage({ id: 'form__drag_or_drop_file_to_import' })}
            </Text>
          </Center>
        ) : (
          <InscribeFilePreview file={fileFromOut} />
        )}
      </div>
      {/* <Box mt={3}>
        <ReceiverErrors receiverErrors={[]} showFileError={showFileError} />
      </Box>
      <Box mt={4}>
        <ReceiverExample />
      </Box> */}
    </>
  );
}

export { InscribeUploader };
