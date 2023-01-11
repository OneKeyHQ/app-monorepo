import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Pressable,
  Text,
  Textarea,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { ReceiverEditor } from '../ReceiverEditor';
import { ReceiverUploader } from '../ReceiverUploader';

function ReceiverInput() {
  const [isUploadMode, setIsUploadMode] = useState(false);
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();

  return (
    <>
      <HStack
        justifyContent="space-between"
        alignItems="center"
        mb={isVertical ? 7 : 8}
      >
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
                  id: isUploadMode ? 'action__edit' : 'action__upload',
                })}
              </Text>
            </HStack>
          )}
        </Pressable>
      </HStack>
      {isUploadMode && <ReceiverUploader />}
      {!isUploadMode && <ReceiverEditor />}
    </>
  );
}

export { ReceiverInput };
