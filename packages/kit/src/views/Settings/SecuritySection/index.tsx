import React, { useCallback, useState } from 'react';

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
import {
  SettingsModalRoutes,
  SettingsRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Settings';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SettingsRoutesParams,
  SettingsModalRoutes.SetPasswordModal
>;

export const SecuritySection = () => {
  const [showResetModal, setShowResetModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const intl = useIntl();
  const [lock, setLock] = useState(false);
  const [faceID, setFaceID] = useState(false);
  const navigation = useNavigation<NavigationProps>();

  const onReset = useCallback(() => {
    setShowResetModal(true);
  }, []);
  return (
    <>
      <Box w="full" mb="4" zIndex={9} shadow="depth.2">
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
              navigation.navigate(SettingsModalRoutes.SetPasswordModal);
            }}
          >
            <Typography.Body1>
              {intl.formatMessage({
                id: 'form__change_password',
                defaultMessage: 'Change Password',
              })}
            </Typography.Body1>
            <Box>
              <Icon name="ChevronRightOutline" size={14} />
            </Box>
          </Pressable>
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            p="4"
            borderBottomWidth="1"
            borderBottomColor="divider"
          >
            <Typography.Body1>
              {intl.formatMessage({
                id: 'form__face_id',
                defaultMessage: 'Face ID',
              })}
            </Typography.Body1>
            <Box>
              <Switch
                labelType="false"
                isChecked={faceID}
                onToggle={() => setFaceID((prev) => !prev)}
              />
            </Box>
          </Box>
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            p="4"
            borderBottomWidth="1"
            borderBottomColor="divider"
          >
            <Typography.Body1>
              {intl.formatMessage({
                id: 'form__app_lock',
                defaultMessage: 'App Lock',
              })}
            </Typography.Body1>
            <Box>
              <Switch
                labelType="false"
                isChecked={lock}
                onToggle={() => setLock((i) => !i)}
              />
            </Box>
          </Box>
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            px="4"
            py="2.5"
            borderBottomWidth="1"
            borderBottomColor="divider"
            zIndex={10}
          >
            <Typography.Body1>
              {intl.formatMessage({
                id: 'form__app_lock_timer',
                defaultMessage: 'Auto-Lock Timer',
              })}
            </Typography.Body1>
            <Box>
              <Select
                title={intl.formatMessage({
                  id: 'form__app_lock_timer',
                  defaultMessage: 'Auto-Lock Timer',
                })}
                isTriggerPlain
                footer={null}
                defaultValue="5 mintus"
                headerShown={false}
                options={[
                  {
                    label: '5 mintus',
                    value: '5 mintus',
                  },
                  {
                    label: '30 mintus',
                    value: '30 mintus',
                  },
                  {
                    label: '60 mintus',
                    value: '60 mintus',
                  },
                ]}
              />
            </Box>
          </Box>
          <Pressable
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            p="4"
            onPress={onReset}
          >
            <Typography.Body1 color="text-critical">
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
        visible={showResetModal}
        onClose={() => setShowResetModal(false)}
        footerButtonProps={{
          onPrimaryActionPress: () => setShowResetModal(false),
          primaryActionTranslationId: 'action__delete',
          primaryActionProps: { type: 'destructive' },
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
              <Input w="full" />
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
