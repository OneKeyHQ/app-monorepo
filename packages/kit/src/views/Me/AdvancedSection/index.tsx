import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Select,
  Text,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import { HomeRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import SelectTrigger from '@onekeyhq/kit/src/views/Me/SelectTrigger';
import {
  HARDWARE_SDK_IFRAME_SRC_ONEKEYCN,
  HARDWARE_SDK_IFRAME_SRC_ONEKEYSO,
} from '@onekeyhq/shared/src/config/appConfig';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { setHardwareConnectSrc } from '../../../store/reducers/settings';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.AdvancedSettings
>;

export const AdvancedSection = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { themeVariant } = useTheme();
  const { dispatch, serviceHardware } = backgroundApiProxy;
  const hardwareConnectSrc = useAppSelector(
    (s) => s.settings.hardwareConnectSrc,
  );

  const hardwareSDKOptions = useMemo(
    () => [
      {
        label: HARDWARE_SDK_IFRAME_SRC_ONEKEYSO,
        value: HARDWARE_SDK_IFRAME_SRC_ONEKEYSO,
      },
      {
        label: HARDWARE_SDK_IFRAME_SRC_ONEKEYCN,
        value: HARDWARE_SDK_IFRAME_SRC_ONEKEYCN,
      },
    ],
    [],
  );

  const onSetHardwareConnectSrc = useCallback(
    (value: string) => {
      dispatch(setHardwareConnectSrc(value));
      serviceHardware.updateSettings({ hardwareConnectSrc: value });
    },
    [dispatch, serviceHardware],
  );

  return (
    <Box w="full" mb="6">
      <Box pb="2">
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({
            id: 'form__advanced__uppercase',
            defaultMessage: 'ADVANCED',
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
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={() => {
            navigation.navigate(HomeRoutes.AdvancedSettings);
          }}
        >
          <Icon name="CircleStackOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex="1"
            numberOfLines={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'form__crypto_settings',
            })}
          </Text>
          <Box>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
      </Box>
      <Box w="full">
        <Select<string>
          title={intl.formatMessage({
            id: 'form__auto_scroll_time',
            defaultMessage: 'Bridge domain',
          })}
          isTriggerPlain
          footer={null}
          value={hardwareConnectSrc}
          defaultValue={hardwareConnectSrc}
          headerShown={false}
          options={hardwareSDKOptions}
          dropdownProps={{ width: '64' }}
          dropdownPosition="right"
          renderTrigger={({ activeOption }) => (
            <SelectTrigger<number>
              title={intl.formatMessage({
                id: 'form__app_lock_timer',
                defaultMessage: 'Auto-Lock Timer',
              })}
              activeOption={activeOption as any}
              iconName="ClockOutline"
            />
          )}
          onChange={onSetHardwareConnectSrc}
        />
      </Box>
    </Box>
  );
};
