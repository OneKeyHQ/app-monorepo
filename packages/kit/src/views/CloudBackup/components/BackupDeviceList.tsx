import type { ReactElement } from 'react';
import { useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { deviceName, osName } from 'expo-device';

import {
  Icon,
  SectionList,
  SizableText,
  Stack,
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
  const [{ isInProgress }] = useCloudBackupPersistAtom();
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
    return backupDeviceList.map((item) => ({
      deviceName: item.deviceInfo.deviceName,
      osName: item.deviceInfo.osName,
      detail: `Updated: ${formatDate(new Date(item.backupTime))}`,
      icon:
        item.deviceInfo.osName in iconList
          ? iconList[item.deviceInfo.osName]
          : 'SuqarePlaceholderOutline',
      isCurrentDevice:
        item.deviceInfo.deviceName === deviceName &&
        item.deviceInfo.osName === osName,
    }));
  }, [iconList]);
  const hasData = (data?.length ?? 0) > 0;
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isInProgress) {
      return;
    }
    if (isFocused) {
      void run();
    }
  }, [isInProgress, isFocused, run]);
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
      renderSectionHeader={() => (
        <SectionList.SectionHeader mt="$5" title="All Devices" />
      )}
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
                        Current
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
          <SizableText size="$bodySm" px="$5" pt="$3">
            OneKey won't back up your hardware wallets, you should write down
            your phrase and keep it safe.
          </SizableText>
        )
      }
      ListEmptyComponent={ListEmptyComponent}
      {...restProps}
    />
  );
}
