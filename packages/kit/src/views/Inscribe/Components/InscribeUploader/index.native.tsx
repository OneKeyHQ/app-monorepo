import { useCallback } from 'react';

import { EncodingType, readAsStringAsync } from 'expo-file-system';
import { useIntl } from 'react-intl';
import { pickSingle, types } from 'react-native-document-picker';

import { Center, Icon, Pressable, Text } from '@onekeyhq/components';

import { InscribeFilePreview } from '../InscribeFilePreview';

import type { Props } from './type';

function getStandardImageBase64(base64Data: string, mimeType: string | null) {
  // 解码 base64 数据
  const binaryData = Buffer.from(base64Data, 'base64');

  // 检查二进制数据的头部信息是否为图片
  const isImage =
    mimeType &&
    mimeType.startsWith('image/') &&
    binaryData[0] === 0xff &&
    binaryData[1] === 0xd8 &&
    binaryData[binaryData.length - 2] === 0xff &&
    binaryData[binaryData.length - 1] === 0xd9;

  if (!isImage) {
    // 如果不是图片，直接返回输入的 base64 数据
    return base64Data;
  }

  // 如果是图片，添加标准的图片 MIME 类型信息，并返回标准的图片 base64 数据
  const standardBase64 = `data:${mimeType};base64,${base64Data}`;
  return standardBase64;
}

function InscribeUploader(props: Props) {
  const {
    file: fileFromOut,
    setFileFromOut,
    // setIsUploadMode,
    // showFileError,
    // setShowFileError,
  } = props;
  const intl = useIntl();

  const handleUploadFile = useCallback(async () => {
    try {
      const file = await pickSingle({
        allowMultiSelection: false,
        copyTo: 'documentDirectory',
        mode: 'open',
        type: [types.plainText, types.audio, types.video, types.images],
      });
      const path = file.fileCopyUri;
      if (!path) return;
      const type = path.split('.').pop();
      if (
        !['json', 'jpg', 'webp', 'png', 'gif', 'txt', 'mp3', 'mp4'].includes(
          type?.toLowerCase() ?? '',
        )
      ) {
        // setShowFileError(true);
        return;
      }
      const b64 = await readAsStringAsync(path, {
        encoding: EncodingType.Base64,
      });

      const imageBase64 = getStandardImageBase64(b64, file.type);
      if (b64 && file.name && file.size && file.type) {
        setFileFromOut({
          data: imageBase64,
          name: file.name,
          size: file.size,
          type: file.type,
        });
        // setShowFileError(false);
      } else {
        // setShowFileError(true);
      }
    } catch {
      // setShowFileError(true);
    }
  }, [setFileFromOut]);

  return (
    <>
      <Pressable
        height="148px"
        onPress={handleUploadFile}
        borderWidth={1}
        borderColor="border-default"
        borderRadius="12px"
        backgroundColor="surface-default"
      >
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
      </Pressable>
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
