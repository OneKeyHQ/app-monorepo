import { useCallback, useMemo } from 'react';

import { StyleSheet } from 'react-native';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Icon,
  Page,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IBackupDataEncryptedPayload } from '@onekeyhq/kit-bg/src/services/ServiceCloudBackupV2/backupProviders/IOneKeyBackupProvider';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import type { IAllWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import CloudBackupEmptyView from '../components/CloudBackupEmptyView';
import { CloudBackupLoadingSkeleton } from '../components/CloudBackupLoadingSkeleton';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { useCloudBackup } from '../hooks/useCloudBackup';

// Mock data for wallets
const MOCK_WALLET_DATA: {
  name: string;
  accountCount: number;
  avatarImg: IAllWalletAvatarImageNames;
}[] = [
  {
    name: 'Wallet 1',
    accountCount: 5,
    avatarImg: 'bear',
  },
  {
    name: 'Wallet 2',
    accountCount: 3,
    avatarImg: 'cat',
  },
  {
    name: 'My Trading Wallet',
    accountCount: 8,
    avatarImg: 'panda',
  },
  {
    name: 'Private Key',
    accountCount: 4,
    avatarImg: 'othersImported',
  },
  {
    name: 'Watch-only Accounts',
    accountCount: 2,
    avatarImg: 'othersWatching',
  },
];

export default function ICloudBackupDetails({
  route,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.ICloudBackupDetails
>) {
  const backupTime = route.params?.backupTime;
  const actionType = route.params?.actionType;
  const navigation = useAppNavigation();
  const { doBackup, doDeleteBackup, doRestoreBackup, checkLoading } =
    useCloudBackup();

  const { result: backupData, isLoading: fetchLoading } = usePromiseResult<
    IPrimeTransferData | IBackupDataEncryptedPayload | undefined
  >(
    async () => {
      await timerUtils.wait(1000);
      if (actionType === 'backup') {
        return backgroundApiProxy.serviceCloudBackupV2.buildBackupData();
      }
      if (actionType === 'restore') {
        if (!route.params?.backupId) {
          Toast.error({
            title: 'Backup ID is required for restore',
          });
          throw new OneKeyLocalError('Backup ID is required for restore');
        }
        const data = await backgroundApiProxy.serviceCloudBackupV2.download({
          recordId: route.params?.backupId,
        });
        return data?.payload;
      }
      return undefined;
    },
    [actionType, route.params?.backupId],
    {
      watchLoading: true,
    },
  );

  const walletData = useMemo(() => {
    return backupData?.publicData?.walletDetails ?? [];
  }, [backupData]);

  const formattedDate = useMemo(() => {
    let dateTime: number | undefined;
    if (backupData?.publicData?.dataTime) {
      dateTime = backupData?.publicData?.dataTime;
    }
    if (!dateTime) {
      return '';
    }
    // return '';
    return formatDate(new Date(dateTime), {
      hideSeconds: true,
    });
  }, [backupData?.publicData?.dataTime]);

  const handleImport = useCallback(async () => {
    doRestoreBackup({ payload: backupData as IBackupDataEncryptedPayload });
  }, [backupData, doRestoreBackup]);

  const handleBackup = useCallback(async () => {
    if (!backupData) {
      throw new OneKeyLocalError('Backup data not found');
    }
    await doBackup({ data: backupData as IPrimeTransferData });
  }, [backupData, doBackup]);

  const renderContent = () => {
    if (fetchLoading) {
      return <CloudBackupLoadingSkeleton />;
    }
    if (walletData.length === 0) {
      return <CloudBackupEmptyView />;
    }
    return walletData.map((item, index) => (
      <ListItem
        key={index}
        gap="$3"
        bg="$bg"
        $platform-web={{
          boxShadow:
            '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        }}
        $theme-dark={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '$neutral3',
        }}
        $platform-native={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '$borderSubdued',
        }}
        borderRadius="$5"
        borderCurve="continuous"
        p="$3"
        m="$0"
        userSelect="none"
      >
        <WalletAvatar img={item.avatar} wallet={undefined} />
        <YStack gap={2} flex={1}>
          <SizableText size="$bodyMdMedium">{item.name}</SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {item.accountsCount}{' '}
            {item.accountsCount === 1 ? 'account' : 'accounts'}
          </SizableText>
        </YStack>
      </ListItem>
    ));
  };

  const isButtonDisabled = useMemo(() => {
    return fetchLoading || checkLoading || !backupData || !walletData.length;
  }, [fetchLoading, checkLoading, backupData, walletData.length]);
  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title={formattedDate} />
        <OnboardingLayout.Body>
          <YStack gap="$3">{renderContent()}</YStack>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <XStack gap="$3" w="100%" py="$3">
            {actionType === 'backup' ? (
              <>
                <Button
                  isLoading={checkLoading}
                  disabled={isButtonDisabled}
                  flex={1}
                  variant="primary"
                  size="large"
                  onPress={handleBackup}
                >
                  Backup
                </Button>
                <Button
                  isLoading={checkLoading}
                  size="large"
                  onPress={async () => {
                    const data =
                      await backgroundApiProxy.serviceCloudBackupV2.getAllBackups();
                    Dialog.debugMessage({
                      debugMessage: data,
                    });
                  }}
                  childrenAsText={false}
                >
                  <Icon name="MenuOutline" />
                </Button>
              </>
            ) : null}

            {actionType === 'restore' ? (
              <>
                <Button
                  isLoading={checkLoading}
                  disabled={isButtonDisabled}
                  flex={1}
                  variant="primary"
                  size="large"
                  onPress={handleImport}
                >
                  Import
                </Button>
                <Button
                  isLoading={checkLoading}
                  disabled={!route.params?.backupId}
                  size="large"
                  onPress={async () => {
                    doDeleteBackup({
                      recordID: route.params?.backupId ?? '',
                    });
                  }}
                  childrenAsText={false}
                >
                  <Icon name="DeleteOutline" />
                </Button>
              </>
            ) : null}
          </XStack>
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}
