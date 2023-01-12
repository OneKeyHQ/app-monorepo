import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  HStack,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { ReceiverEditor } from '../ReceiverEditor';
import { ReceiverUploader } from '../ReceiverUploader';

import type { TokenReceiver } from '../types';

interface Props {
  receiver: TokenReceiver[];
  setReceiver: React.Dispatch<React.SetStateAction<TokenReceiver[]>>;
}

function ReceiverInput(props: Props) {
  const { receiver, setReceiver } = props;
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
          {intl.formatMessage({ id: 'form__receiver_address_amount' })}
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
      {isUploadMode && (
        <ReceiverUploader
          setReceiver={setReceiver}
          setIsUploadMode={setIsUploadMode}
        />
      )}
      {!isUploadMode && (
        <ReceiverEditor receiver={receiver} setReceiver={setReceiver} />
      )}
      <Text fontSize={12} color="text-subdued" mt={isVertical ? 4 : 3}>
        {intl.formatMessage({
          id: 'form__each_line_should_include_the_address_and_the_amount_seperated_by_commas',
        })}
      </Text>
    </>
  );
}

export { ReceiverInput };
