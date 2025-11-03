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
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import type { IAllWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { OnboardingLayout } from '../components/OnboardingLayout';

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
  const { backupTime } = route.params;
  const navigation = useAppNavigation();

  const formattedDate = formatDate(new Date(backupTime), {
    hideSeconds: true,
  });

  const handleImport = () => {
    Toast.success({
      title: 'Backup imported',
    });
  };

  const handleDelete = () => {
    Dialog.show({
      icon: 'DeleteOutline',
      tone: 'destructive',
      title: 'Delete this backup?',
      description:
        "This file will be permanently deleted from iCloud. Make sure you have written down the Recovery phrases as you won't be able to restore the wallets otherwise.",
      onConfirmText: 'Delete',
      confirmButtonProps: {
        variant: 'destructive',
      },
      onCancelText: 'Cancel',
      onConfirm: async () => {
        // Show success toast
        Toast.success({
          title: 'Backup deleted',
        });

        // Navigate back to iCloud backup list
        navigation.pop();
      },
    });
  };

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title={formattedDate} />
        <OnboardingLayout.Body>
          <YStack gap="$3">
            {MOCK_WALLET_DATA.map((item, index) => (
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
                <WalletAvatar img={item.avatarImg} wallet={undefined} />
                <YStack gap={2} flex={1}>
                  <SizableText size="$bodyMdMedium">{item.name}</SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    {item.accountCount}{' '}
                    {item.accountCount === 1 ? 'account' : 'accounts'}
                  </SizableText>
                </YStack>
              </ListItem>
            ))}
          </YStack>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <XStack gap="$3" w="100%" py="$3">
            <Button
              flex={1}
              variant="primary"
              size="large"
              onPress={handleImport}
            >
              Import
            </Button>
            <Button size="large" onPress={handleDelete} childrenAsText={false}>
              <Icon name="DeleteOutline" />
            </Button>
          </XStack>
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}
