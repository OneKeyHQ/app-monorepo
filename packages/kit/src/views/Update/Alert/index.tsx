import React, { FC } from 'react';

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
import { useCheckVersion } from '@onekeyhq/kit/src/hooks/redux';
import { setUpdateActivationHint } from '@onekeyhq/kit/src/store/reducers/checkVersion';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import appUpdates from '../../../utils/updates/AppUpdates';

const UpdateAlert: FC = () => {
  const version = useCheckVersion();

  const isSmallScreen = useIsVerticalLayout();
  const screenWidth = useWindowDimensions().width;

  if (platformEnv.isBrowser) return null;

  return version.updateActivationHint ? (
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
            {`Update to OneKey ${
              version.currentVersionFeature?.version ?? ''
            } is availabel`}
          </Text>
          <Button
            mt={3}
            onPress={() => {
              if (version.currentVersionFeature)
                appUpdates.openAppUpdate(version.currentVersionFeature);
            }}
          >
            Update Now
          </Button>
        </Box>
        <Pressable
          ml={4}
          padding={0.5}
          onPress={() => {
            backgroundApiProxy.dispatch(setUpdateActivationHint(false));
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
