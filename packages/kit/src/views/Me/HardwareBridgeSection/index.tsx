import { useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Text,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import { HomeRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import { openUrlExternal } from '@onekeyhq/kit/src/utils/openUrl';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector } from '../../../hooks';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.HardwareBridgeSettings
>;

export const HardwareBridgeSection = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { themeVariant } = useTheme();

  const hardwareConnectSrc = useAppSelector(
    (s) => s.settings.hardwareConnectSrc,
  );

  const showBridgePortSetting = useMemo<boolean>(
    () => !!(platformEnv.isExtension || platformEnv.isWeb),
    [],
  );

  if (!showBridgePortSetting) {
    return null;
  }

  return (
    <Box w="full" mb="6">
      <Box pb="2">
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({
            id: 'form__hardware_bridge',
            defaultMessage: 'HARDWARE BRIDGE',
          })}
        </Typography.Subheading>
      </Box>
      <Box
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          borderBottomWidth="1"
          borderBottomColor="divider"
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={() => {
            navigation.navigate(HomeRoutes.HardwareBridgeSettings);
          }}
        >
          <Icon name="FolderMinusOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex="1"
            numberOfLines={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'form__hardware_bridge_sdk_url',
            })}
          </Text>
          <Box flexDirection="row" alignItems="center">
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              color="text-subdued"
            >
              {hardwareConnectSrc}
            </Text>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={() => {
            openUrlExternal('http://127.0.0.1:21320/status/');
          }}
        >
          <Icon name="DocumentArrowDownOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex="1"
            numberOfLines={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'form__hardware_bridge_status',
            })}
          </Text>
          <Box flexDirection="row" alignItems="center">
            <Icon
              name="ArrowTopRightOnSquareMini"
              color="icon-subdued"
              size={20}
            />
          </Box>
        </Pressable>
      </Box>
    </Box>
  );
};
