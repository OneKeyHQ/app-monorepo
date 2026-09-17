import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, Dialog, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import { isBluetoothFirmwareUpdateTransport } from '../firmwareUpdateTransportUtils';
import { useStartFirmwareUpdateWorkflow } from '../hooks/useStartFirmwareUpdateWorkflow';
import { FirmwareUpdateTestIDs } from '../testIDs';

export function FirmwareUpdateCheckList({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();
  const { start: startWorkflow } = useStartFirmwareUpdateWorkflow();
  const isMountedRef = useRef(true);
  const isBluetoothTransport = isBluetoothFirmwareUpdateTransport({
    isNative: platformEnv.isNative,
  });

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const checkItems = useMemo(
    () => [
      {
        id: 'backup',
        label: intl.formatMessage({
          id: ETranslations.update_i_have_backed_up_my_recovery_phrase,
        }),
        emoji: '✅',
      },
      {
        id: 'connection',
        label: intl.formatMessage({
          id: isBluetoothTransport
            ? ETranslations.update_device_connected_via_bluetooth
            : ETranslations.update_device_connected_via_usb,
        }),
        emoji: isBluetoothTransport ? '📲' : '🔌',
      },
      ...(isBluetoothTransport
        ? []
        : [
            {
              id: 'single-device',
              label: intl.formatMessage({
                id: ETranslations.update_only_one_device_connected,
              }),
              emoji: '📱',
            },
            {
              id: 'apps-closed',
              label: intl.formatMessage({
                id: ETranslations.update_all_other_apps_closed,
              }),
              emoji: '🆗',
            },
          ]),
    ],
    [intl, isBluetoothTransport],
  );
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const onCheckChanged = useCallback((id: string) => {
    if (!isMountedRef.current) return;
    setCheckedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const isAllChecked = useMemo(
    () => checkItems.every((item) => checkedMap[item.id]),
    [checkItems, checkedMap],
  );

  return (
    <Stack>
      <Stack>
        {checkItems.map((item) => {
          const checked = !!checkedMap[item.id];
          return (
            <Checkbox
              key={item.id}
              value={checked}
              testID={FirmwareUpdateTestIDs.checklistCheckbox}
              label={checked ? `${item.label} ${item.emoji}` : item.label}
              onChange={() => onCheckChanged(item.id)}
            />
          );
        })}
      </Stack>
      <Dialog.Footer
        confirmButtonProps={{
          disabled: !isAllChecked,
        }}
        onConfirm={
          result
            ? async (dialog) => {
                await dialog.close();

                // Wait for React Native Fabric to complete view cleanup
                // This prevents RetryableMountingLayerException during rapid navigation
                await timerUtils.wait(150);

                await startWorkflow({ result, navigateToInstallPage: true });
              }
            : undefined
        }
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        showCancelButton={false}
      />
    </Stack>
  );
}
