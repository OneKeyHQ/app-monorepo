import { useCallback, useMemo } from 'react';

import {
  Button,
  Dialog,
  SizableText,
  Toast,
  XStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

export function CloudAccountBar() {
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
      title: 'Logout',
      // TODO: franco 登出 google 账户
      description: `Are you sure you want to logout ${googleEmail || ''}?`,
      onConfirmText: 'Logout',
      onConfirm: async () => {
        await backgroundApiProxy.serviceCloudBackupV2.logoutCloud();
        navigation.popStack();
        Toast.success({
          title: 'Logged out successfully',
        });
      },
    });
  }, [googleEmail, navigation]);

  if (platformEnv.isNativeAndroid) {
    if (!googleAccountId) {
      return (
        <XStack>
          <SizableText>Google Account not signed in</SizableText>
        </XStack>
      );
    }
    return (
      <XStack>
        <SizableText>{googleEmail}</SizableText>
        <Button onPress={logoutCloud}>Logout</Button>
      </XStack>
    );
  }
  return null;
}
