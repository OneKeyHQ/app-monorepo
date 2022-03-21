import React, { useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  Icon,
  Input,
  Pressable,
  Select,
  Switch,
  Typography,
} from '@onekeyhq/components';
import { useSettings, useStatus } from '@onekeyhq/kit/src/hooks/redux';
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
import { runtimeUnlock } from '../../../store/reducers/general';
import { unlock } from '../../../store/reducers/status';
import { SelectTrigger } from '../SelectTrigger';

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
  const { passwordCompleted } = useStatus();
  const { isOk } = useLocalAuthentication();
  const navigation = useNavigation<NavigationProps>();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [input, setInput] = useState('');
  const lockTimerOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: 'form__always' }),
        value: 0,
      },
      {
        label: intl.formatMessage({ id: 'form__str_minute' }, { 0: 1 }),
        value: 1,
      },
      {
        label: intl.formatMessage({ id: 'form__str_minute' }, { 0: 5 }),
        value: 5,
      },
      {
        label: intl.formatMessage({ id: 'form__str_minute' }, { 0: 30 }),
        value: 30,
      },
      {
        label: intl.formatMessage({ id: 'form__str_hour' }, { 0: 1 }),
        value: 60,
      },
      {
        label: intl.formatMessage({ id: 'form__str_hour' }, { 0: 6 }),
        value: 360,
      },
      {
        label: intl.formatMessage({ id: 'form__str_day' }, { 0: 1 }),
        value: 1440,
      },
      {
        label: intl.formatMessage({ id: 'form__str_day' }, { 0: 7 }),
        value: 10080,
      },
    ],
    [intl],
  );
  const onOpenResetModal = useCallback(() => {
    setShowResetModal(true);
  }, []);
  const onReset = useCallback(async () => {
    await backgroundApiProxy.serviceApp.resetApp();
    setShowResetModal(false);
  }, []);
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
      dispatch(runtimeUnlock());
    }
  }, [enableAppLock, dispatch]);
  return (
    <>
      <Box w="full" mb="4">
        <Box p="2">
          <Typography.Subheading>
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
            p="4"
            borderBottomWidth="1"
            borderBottomColor="divider"
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Password,
                params: { screen: PasswordRoutes.PasswordRoutes },
              });
            }}
          >
            <Typography.Body1 flex="1" numberOfLines={1} mr="3">
              {intl.formatMessage({
                id: passwordCompleted
                  ? 'form__change_password'
                  : 'title__set_password',
              })}
            </Typography.Body1>
            <Box>
              <Icon name="ChevronRightOutline" size={14} />
            </Box>
          </Pressable>
          {isOk ? (
            <Box
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              p="4"
              borderBottomWidth="1"
              borderBottomColor="divider"
            >
              <Typography.Body1 flex="1" numberOfLines={1} mr="3">
                {intl.formatMessage({
                  id: 'form__face_id',
                  defaultMessage: 'Face ID',
                })}
              </Typography.Body1>
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
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            p="4"
            borderBottomWidth="1"
            borderBottomColor="divider"
          >
            <Typography.Body1 flex="1" numberOfLines={1} mr="3">
              {intl.formatMessage({
                id: 'form__app_lock',
                defaultMessage: 'App Lock',
              })}
            </Typography.Body1>
            <Box>
              <Switch
                labelType="false"
                isChecked={enableAppLock}
                onToggle={onToggleAppLock}
              />
            </Box>
          </Box>
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

          <Pressable
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            p="4"
            onPress={onOpenResetModal}
          >
            <Typography.Body1
              color="text-critical"
              flex="1"
              numberOfLines={1}
              mr="3"
            >
              {intl.formatMessage({
                id: 'form__reset_app',
                defaultMessage: 'Reset App',
              })}
            </Typography.Body1>
            <Box>
              <Icon name="ChevronRightOutline" size={14} />
            </Box>
          </Pressable>
        </Box>
      </Box>
      <Dialog
        hasFormInsideDialog
        visible={showResetModal}
        onClose={() => setShowResetModal(false)}
        footerButtonProps={{
          primaryActionTranslationId: 'action__delete',
          primaryActionProps: {
            type: 'destructive',
            isDisabled: input.toUpperCase() !== 'RESET',
            onPromise: onReset,
          },
        }}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'form__reset_app',
            defaultMessage: 'Reset App',
          }),
          content: intl.formatMessage({
            id: 'modal__reset_app_desc',
            defaultMessage:
              'This will delete all the data you have created at OneKey, enter "RESET" to reset the App',
          }),
          input: (
            <Box w="full" mt="4">
              <Input
                w="full"
                value={input}
                onChangeText={(text) => setInput(text.trim())}
              />
            </Box>
          ),
        }}
      />
      <Dialog
        visible={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        footerButtonProps={{
          onPrimaryActionPress: () => setShowBackupModal(false),
          primaryActionTranslationId: 'action__go_tobackup',
          primaryActionProps: { type: 'primary' },
        }}
        contentProps={{
          iconType: 'info',
          title: intl.formatMessage({
            id: 'modal__back_up_your_wallet',
            defaultMessage: 'Back Up Your Wallet',
          }),
          content: intl.formatMessage({
            id: 'modal__back_up_your_wallet_desc',
            defaultMessage:
              "Before resetting the App, make sure you've backed up all of your wallets.",
          }),
        }}
      />
    </>
  );
};
