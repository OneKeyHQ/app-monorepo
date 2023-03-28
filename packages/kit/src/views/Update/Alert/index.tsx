import type { FC } from 'react';

import { useIntl } from 'react-intl';

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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  ModalRoutes,
  RootRoutes,
  UpdateFeatureModalRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import { disable } from '@onekeyhq/kit/src/store/reducers/autoUpdater';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const UpdateAlert: FC = () => {
  const intl = useIntl();
  const { enabled, latest: lastVersion } = useAutoUpdate();

  const navigation = useAppNavigation();
  const isSmallScreen = useIsVerticalLayout();

  if (lastVersion && 'forceUpdate' in lastVersion && lastVersion.forceUpdate) {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.UpdateFeature,
      params: {
        screen: UpdateFeatureModalRoutes.ForcedUpdateModal,
        params: {
          versionInfo: lastVersion,
        },
      },
    });
    return null;
  }

  if (
    platformEnv.isWeb ||
    platformEnv.isExtension ||
    platformEnv.isDesktopMac ||
    platformEnv.isDesktopWin
  ) {
    return null;
  }

  if (!lastVersion) {
    return null;
  }

  // Narrowing type to VersionInfo
  if (!('package' in lastVersion)) {
    return null;
  }

  return enabled ? (
    <Box
      position="absolute"
      width={isSmallScreen ? 'full' : '358px'}
      left={isSmallScreen ? 0 : '288px'}
      bottom={isSmallScreen ? '58px' : '32px'}
      justifyContent="center"
      alignItems="center"
      px={{ base: 4, md: 0 }}
    >
      <Box
        flexDirection="row"
        width="full"
        px={4}
        py={4}
        bg="surface-default"
        borderRadius="xl"
        borderWidth={0.5}
        borderColor="border-subdued"
        shadow="depth.4"
      >
        <Box mr="12px">
          <Icon size={24} name="ArrowDownTrayOutline" color="icon-success" />
        </Box>
        <Box flex={1} mt={0.5}>
          <Text flex={1} typography="Body2Strong" color="text-default">
            {intl.formatMessage(
              { id: 'msg__update_to_onekey_str_is_available' },
              { 0: lastVersion?.package?.version ?? '' },
            )}
          </Text>
          <Button
            alignSelf="flex-start"
            mt={3}
            onPress={() => {
              if (lastVersion) appUpdates.openAppUpdate(lastVersion);
            }}
          >
            {intl.formatMessage({ id: 'action__update_now' })}
          </Button>
        </Box>
        {lastVersion?.forceUpdate ? null : (
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
            <Icon size={20} name="XMarkOutline" color="icon-default" />
          </Pressable>
        )}
      </Box>
    </Box>
  ) : null;
};

export default UpdateAlert;
