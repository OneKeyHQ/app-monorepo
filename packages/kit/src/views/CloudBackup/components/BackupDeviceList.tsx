import type { ReactElement } from 'react';
import { useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { deviceName, osName } from 'expo-device';
import { useIntl } from 'react-intl';

import {
  Icon,
  SectionList,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import type { ISectionListProps } from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components/src/primitives';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMetaDataObject } from '@onekeyhq/kit-bg/src/services/ServiceCloudBackup/types';
import { useCloudBackupPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ECloudBackupRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import BackupListLoading from './BackupListLoading';

export default function BackupDeviceList<T>({
  ListEmptyComponent,
  ...restProps
}: Omit<
  ISectionListProps<T>,
  | 'estimatedItemSize'
  | 'sections'
  | 'getItemLayout'
  | 'keyExtractor'
  | 'CellRendererComponent'
  | 'getItemType'
> & { ListEmptyComponent?: ReactElement }) {
  const intl = useIntl();
  const [{ isEnabled, isInProgress }] = useCloudBackupPersistAtom();
  const navigation = useAppNavigation();
  const iconList: Record<string, string> = useMemo(
    () => ({
      'iOS': 'PhoneOutline',
      'Android': 'PhoneOutline',
      'iPadOS': 'SuqarePlaceholderOutline',
    }),
    [],
  );
  const { result: data, run } = usePromiseResult(async () => {
    const backupDeviceList =
      await backgroundApiProxy.serviceCloudBackup.getBackupDeviceList();
    return !ListEmptyComponent && !isEnabled
      ? []
      : backupDeviceList.map((item) => ({
          deviceName: item.deviceInfo.deviceName,
          osName: item.deviceInfo.osName,
          detail: intl.formatMessage(
            { id: ETranslations.backup_updated_time },
            { time: formatDate(new Date(item.backupTime)) },
          ),
          icon:
            item.deviceInfo.osName in iconList
              ? iconList[item.deviceInfo.osName]
              : 'SuqarePlaceholderOutline',
          isCurrentDevice:
            item.deviceInfo.deviceName === deviceName &&
            item.deviceInfo.osName === osName,
        }));
  }, [intl, iconList, ListEmptyComponent, isEnabled]);
  const hasData = (data?.length ?? 0) > 0;
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isInProgress) {
      return;
    }
    if (isFocused) {
      void run();
    }
  }, [isInProgress, isFocused, run, isEnabled]);
  if (!data) {
    return <BackupListLoading />;
  }
  return (
    <SectionList
      sections={
        hasData
          ? [
              {
                data,
              },
            ]
          : []
      }
      renderSectionHeader={() =>
        !ListEmptyComponent && !isEnabled ? null : (
          <SectionList.SectionHeader
            mt="$5"
            title={intl.formatMessage({ id: ETranslations.backup_all_devices })}
          />
        )
      }
      renderItem={({
        item,
      }: {
        item: IMetaDataObject['deviceInfo'] & {
          detail: string;
          icon: IIconProps['name'];
          isCurrentDevice: boolean;
        };
      }) => (
        <ListItem
          onPress={() => {
            navigation.pushModal(EModalRoutes.CloudBackupModal, {
              screen: ECloudBackupRoutes.CloudBackupList,
              params: {
                deviceInfo: item,
              },
            });
          }}
          renderItemText={(textProps) => (
            <ListItem.Text
              {...textProps}
              primary={
                <XStack alignItems="center">
                  <SizableText size="$bodyLgMedium">
                    {item.deviceName}
                  </SizableText>
                  {item.isCurrentDevice ? (
                    <Stack
                      ml="$1"
                      bg="$bgInfo"
                      px="$2"
                      py="$0.5"
                      borderRadius="$1"
                    >
                      <SizableText size="$bodySmMedium" color="$textInfo">
                        {intl.formatMessage({
                          id: ETranslations.global_current,
                        })}
                      </SizableText>
                    </Stack>
                  ) : null}
                </XStack>
              }
            />
          )}
          subtitle={item.detail}
          icon={item.icon}
          iconProps={{
            bg: '$bgStrong',
            p: '$5',
          }}
          renderIcon={
            <Stack bg="$bgStrong" p="$2" borderRadius="$3">
              <Icon name={item.icon} size="$6" color="$icon" />
            </Stack>
          }
          drillIn
        />
      )}
      estimatedItemSize="$16"
      ListFooterComponent={
        !hasData && ListEmptyComponent ? null : (
          <SizableText size="$bodySm" color="$textSubdued" px="$5" pt="$3">
            {intl.formatMessage({
              id: ETranslations.backup_onekey_doesnt_back_up_hardware_wallets,
            })}
          </SizableText>
        )
      }
      ListEmptyComponent={ListEmptyComponent}
      {...restProps}
    />
  );
}
