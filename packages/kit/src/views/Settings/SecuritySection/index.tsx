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
} from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { useData, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  setAppLockDuration,
  setEnableAppLock,
} from '@onekeyhq/kit/src/store/reducers/settings';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useLocalAuthentication } from '../../../hooks/useLocalAuthentication';
import { EnableLocalAuthenticationRoutes } from '../../../routes/Modal/EnableLocalAuthentication';
import { PasswordRoutes } from '../../../routes/Modal/Password';
import {
  ModalRoutes,
  RootRoutes,
  RootRoutesParams,
} from '../../../routes/types';
import { unlock as mUnlock } from '../../../store/reducers/data';
import { unlock } from '../../../store/reducers/status';
import { SelectTrigger } from '../SelectTrigger';

import ResetButton from './ResetButton';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
>;

export const SecuritySection = () => {
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;
  const { enableAppLock, enableLocalAuthentication, appLockDuration } =
    useSettings();
  const { isPasswordSet } = useData();
  const { isOk } = useLocalAuthentication();
  const navigation = useNavigation<NavigationProps>();
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
        label: intl.formatMessage({ id: 'form__str_hour' }, { '0': 6 }),
        value: 360,
      },
      {
        label: intl.formatMessage({ id: 'form__str_day' }, { '0': 1 }),
        value: 1440,
      },
      {
        label: intl.formatMessage({ id: 'form__str_day' }, { '0': 7 }),
        value: 10080,
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
    if (!enableAppLock) {
      dispatch(unlock());
      dispatch(mUnlock());
    }
  }, [enableAppLock, dispatch]);
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
        <Box borderRadius="12" bg="surface-default" shadow="depth.2">
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
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex="1"
              numberOfLines={1}
              mr="3"
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
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                flex="1"
                numberOfLines={1}
                mr="3"
              >
                {intl.formatMessage({
                  id: 'form__face_id',
                  defaultMessage: 'Face ID',
                })}
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
            </Box>
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
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                flex="1"
                numberOfLines={1}
                mr="3"
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
                value={appLockDuration}
                defaultValue={appLockDuration}
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
                  />
                )}
                onChange={onSetAppLockDuration}
              />
            </Box>
          ) : null}
          <ResetButton />
        </Box>
      </Box>
    </>
  );
};
