import { useState } from 'react';

import { useDropzone } from 'react-dropzone';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Pressable,
  Text,
  Textarea,
} from '@onekeyhq/components';

import { InputUploader } from '../InputUploader';

function IutputEditor() {
  const [isUploadMode, setIsUploadMode] = useState(false);
  const intl = useIntl();

  return (
    <>
      <HStack justifyContent="space-between" alignItems="center" mb={4}>
        <Text fontSize={18} typography="Heading">
          {intl.formatMessage({ id: 'content__support_csv_txt_or_excel' })}
        </Text>
        <Pressable
          _hover={{
            backgroundColor: 'transparent',
          }}
          color="text-subdued"
          onPress={() => setIsUploadMode(!isUploadMode)}
        >
          {({ isHovered }) => (
            <HStack alignItems="center" space="5px">
              <Icon
                size={16}
                name={isUploadMode ? 'PencilOutline' : 'UploadOutline'}
                color={isHovered ? 'text-default' : 'text-subdued'}
              />
              <Text
                color={isHovered ? 'text-default' : 'text-subdued'}
                fontSize={16}
              >
                {intl.formatMessage({
                  id: isUploadMode ? 'action__skip' : 'action__accept',
                })}
              </Text>
            </HStack>
          )}
        </Pressable>
      </HStack>
      <InputUploader />
    </>
  );
}

export { IutputEditor };
