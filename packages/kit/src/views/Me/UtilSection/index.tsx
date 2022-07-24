import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
  useTheme,
} from '@onekeyhq/components';
import extUtils from '@onekeyhq/kit/src/utils/extUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { gotoScanQrcode } from '../../../utils/gotoScanQrcode';

export const UtilSection = () => {
  const intl = useIntl();
  const small = useIsVerticalLayout();
  const { themeVariant } = useTheme();
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  const onLock = useCallback(() => {
    backgroundApiProxy.serviceApp.lock(true);
  }, []);
  return (
    <Box w="full" mb="6">
      <Box
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        {isPasswordSet ? (
          <Pressable
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            py={4}
            px={{ base: 4, md: 6 }}
            onPress={onLock}
          >
            <Icon name="LockOutline" />
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex="1"
              numberOfLines={1}
              mx={3}
            >
              {intl.formatMessage({
                id: 'action__lock_now',
              })}
            </Text>
            <Box>
              <Icon name="ChevronRightSolid" size={20} />
            </Box>
          </Pressable>
        ) : null}
        {platformEnv.isExtensionUiPopup ? (
          <>
            <Divider />
            <Pressable
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              py={4}
              px={{ base: 4, md: 6 }}
              onPress={() => {
                extUtils.openExpandTab({ routes: '' });
              }}
            >
              <Icon name="ArrowsExpandOutline" />
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                flex="1"
                numberOfLines={1}
                mx={3}
              >
                {intl.formatMessage({
                  id: 'form__expand_view',
                })}
              </Text>
              <Box>
                <Icon name="ChevronRightSolid" size={20} />
              </Box>
            </Pressable>
          </>
        ) : null}
        {!platformEnv.isExtFirefoxUiPopup ? (
          <>
            <Divider />
            <Pressable
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              py={4}
              px={{ base: 4, md: 6 }}
              onPress={() => {
                gotoScanQrcode();
              }}
            >
              <Icon name={small ? 'ScanOutline' : 'ScanSolid'} />
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                flex="1"
                numberOfLines={1}
                mx={3}
              >
                {intl.formatMessage({
                  id: 'title__scan_qr_code',
                })}
              </Text>
              <Box>
                <Icon name="ChevronRightSolid" size={20} />
              </Box>
            </Pressable>
          </>
        ) : null}
      </Box>
    </Box>
  );
};
