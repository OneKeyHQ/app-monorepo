import { useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Empty,
  Icon,
  Page,
  SizableText,
  Skeleton,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { OnboardingLayout } from '../components/OnboardingLayout';

const DATA = [
  {
    id: '1',
    time: new Date('2022-06-24T14:43:00.000Z').getTime(),
    walletCount: 3,
    accountCount: 22,
  },
  {
    id: '2',
    time: new Date('2022-06-24T14:43:00.000Z').getTime(),
    walletCount: 1,
    accountCount: 1,
  },
  {
    id: '3',
    time: new Date('2022-06-24T14:43:00.000Z').getTime(),
    walletCount: 1,
    accountCount: 1,
  },
];

function LoadingSkeleton() {
  return (
    <YStack gap="$3">
      {[...Array(3)].map((_, index) => (
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
          <YStack gap={2} flex={1}>
            <Skeleton.BodyMd />
            <Skeleton.BodySm />
          </YStack>
        </ListItem>
      ))}
    </YStack>
  );
}

function EmptyBackup() {
  return <Empty title="No Backups Found" />;
}

export default function ICloudBackup() {
  const navigation = useAppNavigation();

  // Simulate loading and data states
  // In real implementation, this would come from actual API/data fetch
  const [isLoading] = useState(false);
  const [data] = useState(DATA);

  const handleBackupPress = (item: (typeof DATA)[0]) => {
    const params: IOnboardingParamListV2[EOnboardingPagesV2.ICloudBackupDetails] =
      {
        backupTime: item.time,
        backupId: item.id,
        actionType: 'restore',
      };
    navigation.push(EOnboardingPagesV2.ICloudBackupDetails, params);
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }

    if (data.length === 0) {
      return <EmptyBackup />;
    }

    return (
      <>
        {data.map((item, index) => (
          <ListItem
            key={`${item.time}-${index}`}
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
            onPress={() => handleBackupPress(item)}
            userSelect="none"
          >
            <YStack gap={2} flex={1}>
              <SizableText size="$bodyMdMedium">
                {formatDate(new Date(item.time), { hideSeconds: true })}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {item.walletCount} wallets, {item.accountCount} accounts
              </SizableText>
            </YStack>
            <Icon name="ChevronRightSmallOutline" color="$iconDisabled" />
          </ListItem>
        ))}
        <SizableText size="$bodySm" color="$textSubdued" px="$3">
          We'll securely store your most recent 30 daily backups plus the last
          monthly backup for each of the past 24 months, ready for restoration
          at any time.
        </SizableText>
      </>
    );
  };

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="iCloud Backup" />
        <OnboardingLayout.Body>{renderContent()}</OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
