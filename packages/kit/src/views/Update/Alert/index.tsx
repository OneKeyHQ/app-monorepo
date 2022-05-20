import React, { FC } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Button,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAutoUpdate } from '@onekeyhq/kit/src/hooks/redux';
import { disable } from '@onekeyhq/kit/src/store/reducers/autoUpdater';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const UpdateAlert: FC = () => {
  const intl = useIntl();
  const { enabled, latest: lastVersion } = useAutoUpdate();

  const isSmallScreen = useIsVerticalLayout();
  const screenWidth = useWindowDimensions().width;

  if (platformEnv.isWeb) return null;

  return enabled ? (
    <Box
      position="absolute"
      width={isSmallScreen ? `${screenWidth - 32}px` : '358px'}
      top={isSmallScreen ? undefined : '32px'}
      right={isSmallScreen ? '16px' : '32px'}
      bottom={isSmallScreen ? '58px' : undefined}
      justifyContent="center"
      alignItems="center"
    >
      <Box
        flexDirection="row"
        width="auto"
        px={4}
        py={4}
        bg="surface-default"
        borderRadius="xl"
        borderWidth={0.5}
        borderColor="border-subdued"
        shadow="depth.4"
      >
        <Box mr="12px">
          <Icon size={24} name="DownloadOutline" color="icon-success" />
        </Box>
        <Box flex={1} mt={0.5}>
          <Text flex={1} typography="Body2Strong" color="text-default">
            {intl.formatMessage(
              { id: 'msg__update_to_onekey_str_is_available' },
              { 0: lastVersion?.version ?? '' },
            )}
          </Text>
          <Button
            mt={3}
            onPress={() => {
              if (lastVersion) appUpdates.openAppUpdate(lastVersion);
            }}
          >
            {intl.formatMessage({ id: 'action__update_now' })}
          </Button>
        </Box>
        <Pressable
          ml={4}
          padding={0.5}
          onPress={() => {
            backgroundApiProxy.dispatch(disable());
          }}
          rounded="full"
          _hover={{ bgColor: 'surface-hovered' }}
          _pressed={{ bgColor: 'surface-pressed' }}
          alignSelf="flex-start"
        >
          <Icon size={20} name="CloseOutline" color="icon-default" />
        </Pressable>
      </Box>
    </Box>
  ) : null;
};

export default UpdateAlert;
