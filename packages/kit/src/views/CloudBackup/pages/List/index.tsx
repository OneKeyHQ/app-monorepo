import { useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Empty, ListView, Page, SizableText } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMetaDataObject } from '@onekeyhq/kit-bg/src/services/ServiceCloudBackup/types';
import { backupPlatform } from '@onekeyhq/shared/src/cloudfs';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ECloudBackupRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { ICloudBackupParamList } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import type { RouteProp } from '@react-navigation/core';

export default function List() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<ICloudBackupParamList, ECloudBackupRoutes.CloudBackupList>
    >();

  const { deviceInfo } = route.params;

  const { result: data, run } = usePromiseResult(async () => {
    const backupList =
      await backgroundApiProxy.serviceCloudBackup.getBackupListFromDevice(
        deviceInfo,
      );

    return backupList.map((item) => ({
      ...item,
      title: formatDate(new Date(item.backupTime)),
      detail: intl.formatMessage(
        { id: ETranslations.backup_number_wallets_number_accounts },
        {
          number0: item.walletCount,
          number1: item.accountCount,
        },
      ),
    }));
  }, [intl, deviceInfo]);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      void run();
    }
  }, [isFocused, run]);

  return (
    <Page>
      <Page.Header title={deviceInfo.deviceName} />
      <Page.Body>
        <ListView
          data={data}
          renderItem={({
            item,
          }: {
            item: IMetaDataObject & {
              title: string;
              detail: string;
            };
          }) => (
            <ListItem
              onPress={() => {
                navigation.pushModal(EModalRoutes.CloudBackupModal, {
                  screen: ECloudBackupRoutes.CloudBackupDetail,
                  params: {
                    item,
                  },
                });
              }}
              title={item.title}
              subtitle={item.detail}
              drillIn
            />
          )}
          estimatedItemSize="$16"
          ListFooterComponent={
            <SizableText size="$bodySm" color="$textSubdued" px="$5" pt="$3">
              {intl.formatMessage({
                id: ETranslations.backup_securely_store_recent_backups,
              })}
            </SizableText>
          }
          ListEmptyComponent={
            <Empty
              icon="SearchOutline"
              title="No Data"
              description={`You have no ${
                backupPlatform().cloudName
              } backups on this device`}
            />
          }
        />
      </Page.Body>
    </Page>
  );
}
