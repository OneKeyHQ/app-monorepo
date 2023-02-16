import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { HomeRoutes, RootRoutes } from '../../../routes/routesEnum';
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
    type,
    receiverErrors,
    isUploadMode,
    setIsUploadMode,
  } = props;
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const handleToggleUploadMode = useCallback(() => {
    if (platformEnv.isExtFirefoxUiPopup) {
      backgroundApiProxy.serviceApp.openExtensionExpandTab({
        routes: [RootRoutes.Root, HomeRoutes.BulkSender],
      });
      setTimeout(() => {
        window.close();
      }, 300);
    } else {
      setIsUploadMode(!isUploadMode);
    }
  }, [isUploadMode, setIsUploadMode]);

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
          onPress={handleToggleUploadMode}
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
      <Box display={isUploadMode ? 'flex' : 'none'}>
        <ReceiverUploader
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
          type={type}
          receiverErrors={receiverErrors}
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
