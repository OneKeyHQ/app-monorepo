import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Select,
  Switch,
  Text,
  ToastManager,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import {
  setAppLockDuration,
  setEnableAppLock,
} from '@onekeyhq/kit/src/store/reducers/settings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useLocalAuthentication } from '../../../hooks/useLocalAuthentication';
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import {
  isContextSupportWebAuthn,
  isMac,
  isSupportedPlatform,
  isUserVerifyingPlatformAuthenticatorAvailable,
} from '../../../utils/webauthn';
import { EnableLocalAuthenticationRoutes } from '../../EnableLocalAuthentication/types';
import { PasswordRoutes } from '../../Password/types';
import { SelectTrigger } from '../SelectTrigger';

import ResetButton from './ResetButton';

import type { HomeRoutesParams, RootRoutesParams } from '../../../routes/types';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<RootRoutesParams, RootRoutes.Main>,
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.Protected>
>;

export const SecuritySection = () => {
  const intl = useIntl();
  const { dispatch, serviceCloudBackup } = backgroundApiProxy;
  const [isHardwareSupportWebAuthn, setHardwareSupportWebAuthn] =
    useState<boolean>(false);
  useEffect(() => {
    if (isSupportedPlatform && isContextSupportWebAuthn && isMac()) {
      isUserVerifyingPlatformAuthenticatorAvailable().then((result) =>
        setHardwareSupportWebAuthn(result),
      );
    }
  }, []);
  const enableWebAuthn = useAppSelector((s) => s.settings.enableWebAuthn);
  const enableAppLock = useAppSelector((s) => s.settings.enableAppLock);
  const appLockDuration = useAppSelector((s) => s.settings.appLockDuration);
  const enableLocalAuthentication = useAppSelector(
    (s) => s.settings.enableLocalAuthentication,
  );
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  const authenticationType = useAppSelector((s) => s.status.authenticationType);

  const { isOk } = useLocalAuthentication();
  const navigation = useNavigation<NavigationProps>();
  const { themeVariant } = useTheme();
  const lockTimerOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: 'form__always' }),
        value: 0,
      },
      {
        label: intl.formatMessage({ id: 'form__str_minute' }, { '0': 1 }),
        value: 1,
      },
      {
        label: intl.formatMessage({ id: 'form__str_minute' }, { '0': 5 }),
        value: 5,
      },
      {
        label: intl.formatMessage({ id: 'form__str_minute' }, { '0': 30 }),
        value: 30,
      },
      {
        label: intl.formatMessage({ id: 'form__str_hour' }, { '0': 1 }),
        value: 60,
      },
      {
        label: intl.formatMessage({ id: 'form__str_hour' }, { '0': 4 }),
        value: 240,
      },
    ],
    [intl],
  );
  const onSetAppLockDuration = useCallback(
    (value: number) => {
      dispatch(setAppLockDuration(value));
    },
    [dispatch],
  );
  const onToggleAppLock = useCallback(() => {
    dispatch(setEnableAppLock(!enableAppLock));
  }, [enableAppLock, dispatch]);
  const lockDuration = Math.min(240, appLockDuration);

  const backupEnable =
    platformEnv.isNativeIOS || platformEnv.isNativeAndroidGooglePlay;
  return (
    <Box w="full" mb="6">
      <Box pb="2">
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({
            id: 'form__security_uppercase',
            defaultMessage: 'SECURITY',
          })}
        </Typography.Subheading>
      </Box>
      <Box
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        {backupEnable ? (
          <Pressable
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            py={4}
            px={{ base: 4, md: 6 }}
            borderBottomWidth="1"
            borderBottomColor="divider"
            onPress={() => {
              serviceCloudBackup.loginIfNeeded(false).then((isLogin) => {
                if (isLogin) {
                  navigation.navigate(HomeRoutes.CloudBackup);
                } else {
                  serviceCloudBackup
                    .loginIfNeeded(true)
                    .then((result) => {
                      if (result) {
                        navigation.navigate(HomeRoutes.CloudBackup);
                      }
                    })
                    .catch((error: Error) => {
                      if (error.message === 'NETWORK') {
                        ToastManager.show(
                          {
                            title: intl.formatMessage({
                              id: 'title__no_connection_desc',
                            }),
                          },
                          {
                            type: 'error',
                          },
                        );
                      }
                    });
                }
              });
            }}
          >
            <Icon name="CloudOutline" />
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex="1"
              numberOfLines={1}
              mx={3}
            >
              {intl.formatMessage({
                id: 'action__backup',
              })}
            </Text>
            <Box>
              <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
            </Box>
          </Pressable>
        ) : undefined}
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Password,
              params: { screen: PasswordRoutes.PasswordRoutes },
            });
          }}
        >
          <Icon name="KeyOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex="1"
            numberOfLines={1}
            mx={3}
          >
            {intl.formatMessage({
              id: isPasswordSet
                ? 'form__change_password'
                : 'title__set_password',
            })}
          </Text>
          <Box>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
        {isHardwareSupportWebAuthn && isContextSupportWebAuthn ? (
          <Pressable
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            py={4}
            px={{ base: 4, md: 6 }}
            borderBottomWidth="1"
            borderBottomColor="divider"
            onPress={() => {
              // navigation.navigate(HomeRoutes.CloudBackup);
            }}
          >
            <Icon name="FingerPrintOutline" />
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex="1"
              numberOfLines={1}
              mx={3}
            >
              {intl.formatMessage({ id: 'form__touch_id' })}
            </Text>
            <Box>
              <Switch
                labelType="false"
                isChecked={enableWebAuthn}
                onToggle={() => {
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.EnableLocalAuthentication,
                    params: {
                      screen: EnableLocalAuthenticationRoutes.EnableWebAuthn,
                    },
                  });
                }}
              />
            </Box>
          </Pressable>
        ) : undefined}
        {isOk && isPasswordSet ? (
          <Pressable
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            py={4}
            px={{ base: 4, md: 6 }}
            borderBottomWidth="1"
            borderBottomColor="divider"
          >
            <Icon
              name={
                authenticationType === 'FACIAL'
                  ? 'FaceIdOutline'
                  : 'FingerPrintOutline'
              }
            />
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex="1"
              numberOfLines={1}
              mx={3}
            >
              {authenticationType === 'FACIAL'
                ? intl.formatMessage({
                    id: 'content__face_id',
                  })
                : intl.formatMessage({ id: 'content__touch_id' })}
            </Text>
            <Box>
              <Switch
                labelType="false"
                isChecked={enableLocalAuthentication}
                onToggle={() => {
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.EnableLocalAuthentication,
                    params: {
                      screen:
                        EnableLocalAuthenticationRoutes.EnableLocalAuthenticationModal,
                    },
                  });
                }}
              />
            </Box>
          </Pressable>
        ) : null}
        {isPasswordSet ? (
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            py={4}
            px={{ base: 4, md: 6 }}
            borderBottomWidth="1"
            borderBottomColor="divider"
          >
            <Icon name="LockClosedOutline" />
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex="1"
              numberOfLines={1}
              mx={3}
            >
              {intl.formatMessage({
                id: 'form__app_lock',
                defaultMessage: 'App Lock',
              })}
            </Text>
            <Box>
              <Switch
                labelType="false"
                isChecked={enableAppLock}
                onToggle={onToggleAppLock}
              />
            </Box>
          </Box>
        ) : null}
        {enableAppLock ? (
          <Box w="full">
            <Select<number>
              title={intl.formatMessage({
                id: 'form__app_lock_timer',
                defaultMessage: 'Auto-Lock Timer',
              })}
              isTriggerPlain
              footer={null}
              value={lockDuration}
              defaultValue={lockDuration}
              headerShown={false}
              options={lockTimerOptions}
              dropdownProps={{ width: '64' }}
              dropdownPosition="right"
              renderTrigger={({ activeOption }) => (
                <SelectTrigger<number>
                  title={intl.formatMessage({
                    id: 'form__app_lock_timer',
                    defaultMessage: 'Auto-Lock Timer',
                  })}
                  activeOption={activeOption}
                  iconName="ClockOutline"
                />
              )}
              onChange={onSetAppLockDuration}
            />
          </Box>
        ) : null}
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() => {
            navigation.navigate(HomeRoutes.Protected);
          }}
        >
          <Icon name="ShieldCheckOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex="1"
            numberOfLines={1}
            mx={3}
          >
            {intl.formatMessage({ id: 'action__protection' })}
          </Text>
          <Box>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
        <ResetButton />
      </Box>
    </Box>
  );
};
