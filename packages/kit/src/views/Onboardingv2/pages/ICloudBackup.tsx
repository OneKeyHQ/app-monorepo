import { useCallback, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { noop } from 'lodash';
import { StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  Empty,
  Icon,
  Page,
  SizableText,
  Skeleton,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IBackupDataManifestItem } from '@onekeyhq/kit-bg/src/services/ServiceCloudBackupV2/backupProviders/IOneKeyBackupProvider';
import { useOnboardingCloudBackupListRefreshAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import CloudBackupEmptyView from '../components/CloudBackupEmptyView';
import { CloudBackupLoadingSkeleton } from '../components/CloudBackupLoadingSkeleton';
import { OnboardingLayout } from '../components/OnboardingLayout';

export default function ICloudBackup() {
  const navigation = useAppNavigation();
  const [refreshHook] = useOnboardingCloudBackupListRefreshAtom();

  const { result: allBackups, isLoading } = usePromiseResult(
    async () => {
      await timerUtils.wait(1000);
      noop(refreshHook);
      return backgroundApiProxy.serviceCloudBackupV2.getAllBackups();
    },
    [refreshHook],
    {
      watchLoading: true,
    },
  );

  const handleBackupPress = useCallback(
    (item: IBackupDataManifestItem) => {
      const params: IOnboardingParamListV2[EOnboardingPagesV2.ICloudBackupDetails] =
        {
          backupTime: item.dataTime,
          backupId: item.recordID,
          actionType: 'restore',
        };
      navigation.push(EOnboardingPagesV2.ICloudBackupDetails, params);
    },
    [navigation],
  );

  const renderContent = () => {
    if (isLoading) {
      return <CloudBackupLoadingSkeleton />;
    }

    if (allBackups?.items?.length === 0) {
      return <CloudBackupEmptyView />;
    }

    return (
      <>
        {allBackups?.items?.map((item, index) => (
          <ListItem
            key={`${item.dataTime}-${index}`}
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
                {item.dataTime
                  ? formatDate(new Date(item.dataTime), { hideSeconds: true })
                  : 'ERROR: Invalid Backup'}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {item.totalWalletsCount} wallets, {item.totalAccountsCount}{' '}
                accounts
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
        <Button
          onPress={() => Dialog.debugMessage({ debugMessage: allBackups })}
        >
          ShowDebugMessage
        </Button>
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
