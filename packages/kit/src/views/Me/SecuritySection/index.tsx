import React, { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Select,
  Switch,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { useData, useSettings, useStatus } from '@onekeyhq/kit/src/hooks/redux';
import {
  setAppLockDuration,
  setEnableAppLock,
} from '@onekeyhq/kit/src/store/reducers/settings';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useLocalAuthentication } from '../../../hooks/useLocalAuthentication';
import { EnableLocalAuthenticationRoutes } from '../../../routes/Modal/EnableLocalAuthentication';
import { PasswordRoutes } from '../../../routes/Modal/Password';
import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  RootRoutes,
  RootRoutesParams,
} from '../../../routes/types';
import { SelectTrigger } from '../SelectTrigger';

import ResetButton from './ResetButton';

import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<RootRoutesParams, RootRoutes.Root>,
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.Protected>
>;

export const SecuritySection = () => {
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;
  const { enableAppLock, appLockDuration, enableLocalAuthentication } =
    useSettings();
  const { isPasswordSet } = useData();
  const { authenticationType } = useStatus();
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
  return (
    <>
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
              <Icon name="ChevronRightSolid" size={20} />
            </Box>
          </Pressable>
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
                renderTrigger={(activeOption) => (
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
            <Icon name="UmbrellaOutline" />
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex="1"
              numberOfLines={1}
              mx={3}
            >
              {intl.formatMessage({ id: 'action__protection' })}
            </Text>
            <Box>
              <Icon name="ChevronRightSolid" size={20} />
            </Box>
          </Pressable>
          <ResetButton />
        </Box>
      </Box>
    </>
  );
};
