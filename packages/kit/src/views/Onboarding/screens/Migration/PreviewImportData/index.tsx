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
  Center,
  Icon,
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
        // TODO: Is setHasLocalData necessary?
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

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const children = useMemo(
    () => (
      <>
        <Box flex={1} flexDirection="column">
          <ScrollView
            flex={1}
            mb="24px"
            minHeight="160px"
            maxHeight={{ base: undefined, sm: '320px' }}
          >
            {hasRemoteData ? (
              <Box mx="-48px" my="-16px">
                <GroupedBackupDetails
                  onDevice={false}
                  publicBackupData={backupData.notOnDevice}
                  showTitle={false}
                />
              </Box>
            ) : (
              <Text typography="Body1">
                {intl.formatMessage({
                  id: 'empty__migrated_data_already_exists',
                })}
              </Text>
            )}
          </ScrollView>
        </Box>
        {hasRemoteData ? (
          <Button
            type="primary"
            size={isVerticalLayout ? 'xl' : 'lg'}
            onPress={importAction}
          >
            {intl.formatMessage({ id: 'action__import' })}
          </Button>
        ) : (
          <Button
            size={isVerticalLayout ? 'xl' : 'lg'}
            /* TODO: add click event to exit onboarding */
          >
            {intl.formatMessage({ id: 'action__close' })}
          </Button>
        )}
      </>
    ),
    [
      backupData.notOnDevice,
      hasRemoteData,
      importAction,
      intl,
      isVerticalLayout,
    ],
  );

  const secondaryContent = useMemo(() => {
    if (isVerticalLayout) {
      return null;
    }
    return (
      <Box width="286px">
        <Center
          size="48px"
          bgColor="decorative-surface-two"
          borderRadius="9999"
        >
          <Icon
            name="EllipsisHorizontalCircleOutline"
            size={24}
            color="decorative-icon-two"
          />
        </Center>
        <Text typography="Body2" mt="26px">
          {intl.formatMessage({
            id: 'content__migration_note_hardware_wallet',
          })}
        </Text>
      </Box>
    );
  }, [intl, isVerticalLayout]);

  return (
    <Layout
      disableAnimation
      title={intl.formatMessage({ id: 'action__preview' })}
      fullHeight
      secondaryContent={secondaryContent}
    >
      {children}
    </Layout>
  );
};

PreviewImportData.defaultProps = defaultProps;

export default PreviewImportData;
