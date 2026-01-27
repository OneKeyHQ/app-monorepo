import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Divider,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDeviceType } from '@onekeyfe/hd-core';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

interface ILegacyUpdateCheckListProps {
  deviceType: IDeviceType | string;
  currentFirmwareVersion: string;
  currentBootloaderVersion: string;
  targetFirmwareVersion?: string;
  onStartUpdate: () => void;
  isStarting?: boolean;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack justifyContent="space-between" alignItems="center" py="$2">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMd" color="$text">
        {value}
      </SizableText>
    </XStack>
  );
}

export function LegacyUpdateCheckList({
  deviceType,
  currentFirmwareVersion,
  currentBootloaderVersion,
  targetFirmwareVersion,
  onStartUpdate,
  isStarting = false,
}: ILegacyUpdateCheckListProps) {
  const intl = useIntl();

  const checkItems = useMemo(
    () => [
      {
        key: 'backup',
        label: intl.formatMessage({
          id: ETranslations.update_i_have_backed_up_my_recovery_phrase,
        }),
        emoji: '',
        value: false,
      },
      {
        key: 'connection',
        label: intl.formatMessage({
          id: platformEnv.isNative
            ? ETranslations.update_device_connected_via_bluetooth
            : ETranslations.update_device_connected_via_usb,
        }),
        emoji: platformEnv.isNative ? '' : '',
        value: false,
      },
      ...(platformEnv.isNative
        ? []
        : [
            {
              key: 'singleDevice',
              label: intl.formatMessage({
                id: ETranslations.update_only_one_device_connected,
              }),
              emoji: '',
              value: false,
            },
            {
              key: 'otherApps',
              label: intl.formatMessage({
                id: ETranslations.update_all_other_apps_closed,
              }),
              emoji: '',
              value: false,
            },
          ]),
    ],
    [intl],
  );

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const onCheckChanged = useCallback((key: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const isAllChecked = useMemo(
    () => checkItems.every((item) => checkedItems[item.key]),
    [checkItems, checkedItems],
  );

  const deviceTypeDisplay = useMemo(() => {
    const typeMap: Record<string, string> = {
      classic: 'OneKey Classic',
      classic1s: 'OneKey Classic 1S',
      mini: 'OneKey Mini',
      touch: 'OneKey Touch',
      pro: 'OneKey Pro',
    };
    return typeMap[deviceType.toLowerCase()] || deviceType;
  }, [deviceType]);

  return (
    <YStack
      space="$4"
      animation="medium"
      enterStyle={{
        opacity: 0,
        y: 10,
      }}
      opacity={1}
      y={0}
    >
      {/* Device Info Section */}
      <YStack
        backgroundColor="$bgSubdued"
        borderRadius="$3"
        px="$4"
        py="$2"
        animation="quick"
        enterStyle={{
          opacity: 0,
          scale: 0.98,
        }}
        opacity={1}
        scale={1}
      >
        <InfoRow
          label={intl.formatMessage({ id: ETranslations.global_device })}
          value={deviceTypeDisplay}
        />
        <Divider />
        <InfoRow
          label={intl.formatMessage({
            id: ETranslations.global_current,
          })}
          value={currentFirmwareVersion || '--'}
        />
        {currentBootloaderVersion ? (
          <>
            <Divider />
            <InfoRow
              label={intl.formatMessage({
                id: ETranslations.update_updating_bootloader,
              })}
              value={currentBootloaderVersion}
            />
          </>
        ) : null}
        {targetFirmwareVersion ? (
          <>
            <Divider />
            <InfoRow
              label={intl.formatMessage({
                id: ETranslations.update_latest_version,
              })}
              value={targetFirmwareVersion}
            />
          </>
        ) : null}
      </YStack>

      {/* Check List Section */}
      <YStack
        space="$2"
        animation="medium"
        enterStyle={{
          opacity: 0,
          y: 5,
        }}
        opacity={1}
        y={0}
      >
        <SizableText size="$headingSm" color="$text">
          {intl.formatMessage({
            id: ETranslations.update_ready_to_upgrade_checklist,
          })}
        </SizableText>
        <Stack space="$1">
          {checkItems.map((item) => (
            <Checkbox
              key={item.key}
              value={checkedItems[item.key] || false}
              label={
                checkedItems[item.key]
                  ? `${item.label} ${item.emoji}`
                  : item.label
              }
              onChange={() => onCheckChanged(item.key)}
            />
          ))}
        </Stack>
      </YStack>

      {/* Start Button */}
      <Stack
        animation="slow"
        enterStyle={{
          opacity: 0,
          y: 10,
        }}
        opacity={1}
        y={0}
      >
        <Button
          variant="primary"
          size="large"
          disabled={!isAllChecked || isStarting}
          loading={isStarting}
          onPress={onStartUpdate}
        >
          {intl.formatMessage({ id: ETranslations.global_continue })}
        </Button>
      </Stack>
    </YStack>
  );
}
