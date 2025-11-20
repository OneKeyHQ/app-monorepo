import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

export function CloudAccountBar() {
  const intl = useIntl();
  const { result: cloudAccountInfo } = usePromiseResult(async () => {
    return backgroundApiProxy.serviceCloudBackupV2.getCloudAccountInfo();
  }, []);

  const googleEmail = useMemo(() => {
    return cloudAccountInfo?.googleDrive?.userInfo?.user?.email;
  }, [cloudAccountInfo]);
  const googleAccountId = useMemo(() => {
    return cloudAccountInfo?.googleDrive?.userInfo?.user?.id;
  }, [cloudAccountInfo]);

  const navigation = useAppNavigation();

  const logoutCloud = useCallback(async () => {
    Dialog.confirm({
      title: intl.formatMessage({ id: ETranslations.global_logout }),
      description: intl.formatMessage(
        {
          id: ETranslations.log_out_confirmation_text,
        },
        {
          email: googleEmail,
        },
      ),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_logout }),
      onConfirm: async () => {
        await backgroundApiProxy.serviceCloudBackupV2.logoutCloud();
        navigation.popStack();
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.logged_out_feedback,
          }),
        });
      },
    });
  }, [googleEmail, intl, navigation]);

  if (platformEnv.isNativeAndroid) {
    return (
      <XStack
        alignItems="center"
        gap="$2"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$5"
        p="$3"
      >
        <Icon name="PeopleCircleOutline" color="$iconSubdued" size="$5" />
        {!googleAccountId ? (
          <SizableText>
            {intl.formatMessage({
              id: ETranslations.google_account_not_signed_in,
            })}
          </SizableText>
        ) : (
          <>
            <SizableText flex={1}>{googleEmail}</SizableText>
            <Button variant="primary" size="small" onPress={logoutCloud}>
              {intl.formatMessage({ id: ETranslations.global_logout })}
            </Button>
          </>
        )}
      </XStack>
    );
  }
  return null;
}
