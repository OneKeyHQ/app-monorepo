import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  ScrollView,
  Text,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type {
  HomeRoutes,
  HomeRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { RestoreResult } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.enums';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { useData } from '../../../../../hooks/redux';
import useImportBackupPasswordModal from '../../../../../hooks/useImportBackupPasswordModal';
import useLocalAuthenticationModal from '../../../../../hooks/useLocalAuthenticationModal';
import { useOnboardingDone } from '../../../../../hooks/useOnboardingRequired';
import { GroupedBackupDetails } from '../../../../Me/SecuritySection/CloudBackup/BackupDetails';
import Layout from '../../../Layout';

import type { EOnboardingRoutes } from '../../../routes/enums';
import type { IOnboardingRoutesParams } from '../../../routes/types';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const defaultProps = {} as const;

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.InitialTab
>;

type RouteProps = RouteProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.MigrationPreview
>;

const PreviewImportData = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { data } = route.params;
  const navigation = useNavigation<NavigationProps>();
  const { serviceCloudBackup } = backgroundApiProxy;
  const isVerticalLayout = useIsVerticalLayout();
  const { isPasswordSet } = useData();
  const { showVerify } = useLocalAuthenticationModal();
  const onboardingDone = useOnboardingDone();

  const { requestBackupPassword } = useImportBackupPasswordModal();

  const [hasLocalData, setHasLocalData] = useState(false);
  const [hasRemoteData, setHasRemoteData] = useState(false);
  const [backupData, setBackupData] = useState({
    alreadyOnDevice: {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
    },
    notOnDevice: {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
    },
  });

  const onImportDone = useCallback(async () => {
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__backup_imported' }),
    });
    await onboardingDone({ delay: 200 });
  }, [intl, onboardingDone]);

  const onImportError = useCallback(() => {
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__unknown_error' }),
    });
    navigation.goBack();
  }, [intl, navigation]);

  const importAction = useCallback(() => {
    if (isPasswordSet) {
      showVerify(
        (localPassword) => {
          serviceCloudBackup
            .restoreFromPrivateBackup({
              privateBackupData: data.private,
              notOnDevice: backupData.notOnDevice,
              localPassword,
            })
            .then((r) => {
              if (r === RestoreResult.SUCCESS) {
                onImportDone();
              } else if (r === RestoreResult.WRONG_PASSWORD) {
                requestBackupPassword(
                  (remotePassword) =>
                    serviceCloudBackup.restoreFromPrivateBackup({
                      privateBackupData: data.private,
                      notOnDevice: backupData.notOnDevice,
                      localPassword,
                      remotePassword,
                    }),
                  onImportDone,
                  onImportError,
                );
              } else {
                onImportError();
              }
            });
        },
        () => {},
      );
    } else {
      requestBackupPassword(
        (remotePassword) =>
          serviceCloudBackup.restoreFromPrivateBackup({
            privateBackupData: data.private,
            notOnDevice: backupData.notOnDevice,
            localPassword: remotePassword,
            remotePassword,
          }),
        onImportDone,
        onImportError,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    backupData.notOnDevice,
    isPasswordSet,
    onImportDone,
    onImportError,
    requestBackupPassword,
    serviceCloudBackup,
    showVerify,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    serviceCloudBackup
      .getBackupDetailsWithRemoteData(JSON.parse(data.public))
      .then((backupDetails) => {
        setBackupData(backupDetails);
        setHasLocalData(
          Object.values(backupDetails.alreadyOnDevice).some(
            (o) => Object.keys(o).length > 0,
          ),
        );
        setHasRemoteData(
          Object.values(backupDetails.notOnDevice).some(
            (o) => Object.keys(o).length > 0,
          ),
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceCloudBackup]);
  const [contentHeight, setContentHeight] = useState<number>(0);

  const maxHeight = useMemo(() => {
    if (isVerticalLayout) {
      return contentHeight;
    }
    return 320;
  }, [contentHeight, isVerticalLayout]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const children = useMemo(
    () => (
      <>
        <Box
          onLayout={(e) => {
            if (contentHeight !== e.nativeEvent.layout.height) {
              setContentHeight(e.nativeEvent.layout.height);
            }
          }}
          flex={1}
          flexDirection="column"
          mx={-12}
        >
          {maxHeight > 0 && (
            <ScrollView
              flex={1}
              maxHeight={`${maxHeight}px`}
              minHeight={isVerticalLayout ? undefined : '320px'}
            >
              {hasLocalData ? (
                <GroupedBackupDetails
                  onDevice
                  publicBackupData={backupData.alreadyOnDevice}
                />
              ) : undefined}
              {hasRemoteData ? (
                <GroupedBackupDetails
                  onDevice={false}
                  publicBackupData={backupData.notOnDevice}
                />
              ) : undefined}
            </ScrollView>
          )}
        </Box>
        {hasRemoteData ? (
          <Button type="primary" size="xl" onPress={importAction}>
            {intl.formatMessage({ id: 'action__import' })}
          </Button>
        ) : null}
      </>
    ),
    [
      backupData.alreadyOnDevice,
      backupData.notOnDevice,
      contentHeight,
      hasLocalData,
      hasRemoteData,
      importAction,
      intl,
      isVerticalLayout,
      maxHeight,
    ],
  );

  const secondaryContent = useMemo(() => {
    if (isVerticalLayout) {
      return null;
    }
    return (
      <Box width="286px">
        <Box size="48px" bgColor="red.100" />
        <Text typography="Body2" mt="26px">
          Hardware wallets will not be synced; you should write down your phrase
          and keep it safe.
        </Text>
      </Box>
    );
  }, [isVerticalLayout]);

  return (
    <Layout
      disableAnimation
      title="Preview"
      fullHeight
      secondaryContent={secondaryContent}
    >
      {children}
    </Layout>
  );
};

PreviewImportData.defaultProps = defaultProps;

export default PreviewImportData;
