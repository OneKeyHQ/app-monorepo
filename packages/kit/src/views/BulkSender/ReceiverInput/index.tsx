import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { ReceiverEditor } from '../ReceiverEditor';
import { ReceiverUploader } from '../ReceiverUploader';

import type { ReceiverInputParams } from '../types';

function ReceiverInput(props: ReceiverInputParams) {
  const {
    accountId,
    networkId,
    receiverFromOut,
    setReceiverFromOut,
    setReceiver,
    receiverErrors,
    isUploadMode,
    setIsUploadMode,
  } = props;
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const [showFileError, setShowFileError] = useState(false);

  useEffect(() => {
    setShowFileError(false);
  }, [isUploadMode]);

  return (
    <>
      <HStack justifyContent="space-between" alignItems="center" mb="10px">
        <Text fontSize={18} typography="Heading">
          {intl.formatMessage({ id: 'form__receiver_address_amount' })}
        </Text>
        <HStack>
          <Button
            type="plain"
            leftIconName="ArrowUpTrayMini"
            onPress={() => setIsUploadMode(!isUploadMode)}
          >
            {intl.formatMessage({
              id: isUploadMode ? 'action__edit' : 'action__upload',
            })}
          </Button>
          <Button type="plain" leftIconName="UserCircleOutline">
            {intl.formatMessage({ id: 'form__account' })}
          </Button>
          <Button type="plain" leftIconName="BookOpenOutline">
            {intl.formatMessage({ id: 'title__contacts' })}
          </Button>
        </HStack>
      </HStack>
      <Box display={isUploadMode ? 'flex' : 'none'}>
        <ReceiverUploader
          showFileError={showFileError}
          setShowFileError={setShowFileError}
          setReceiverFromOut={setReceiverFromOut}
          setIsUploadMode={setIsUploadMode}
        />
      </Box>
      <Box display={isUploadMode ? 'none' : 'flex'}>
        <ReceiverEditor
          accountId={accountId}
          networkId={networkId}
          setReceiver={setReceiver}
          receiverFromOut={receiverFromOut}
          setReceiverFromOut={setReceiverFromOut}
          receiverErrors={receiverErrors}
          showFileError={showFileError}
          setShowFileError={setShowFileError}
        />
      </Box>
      <Text fontSize={12} color="text-subdued" mt={isVertical ? 4 : 3}>
        {intl.formatMessage({
          id: 'form__each_line_should_include_the_address_and_the_amount_seperated_by_commas',
        })}
      </Text>
    </>
  );
}

export { ReceiverInput };
