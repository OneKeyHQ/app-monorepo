import { useEffect, useMemo } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useFirmwareUpdatesDetectStatusPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { selectFirmwareUpdateDetectStatus } from '../utils';

export function useFirmwareUpdateDetectStatus(connectId: string | undefined) {
  const [persistedStatus] = useFirmwareUpdatesDetectStatusPersistAtom();
  const { result: snapshot, run } = usePromiseResult(
    async () => {
      if (!connectId) return undefined;
      return backgroundApiProxy.serviceFirmwareUpdate.getFirmwareUpdateDetectStatus(
        { connectId },
      );
    },
    [connectId],
    { checkIsFocused: false },
  );

  useEffect(() => {
    const refresh = ({ connectIds }: { connectIds: string[] }) => {
      if (
        connectId &&
        (connectIds.length === 0 ||
          connectIds.some(
            (changedConnectId) =>
              changedConnectId.toLowerCase() === connectId.toLowerCase(),
          ))
      ) {
        void run({ alwaysSetState: true });
      }
    };
    appEventBus.on(
      EAppEventBusNames.FirmwareUpdateDetectStatusChanged,
      refresh,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.FirmwareUpdateDetectStatusChanged,
        refresh,
      );
    };
  }, [connectId, run]);

  return useMemo(() => {
    if (!connectId) return undefined;
    return selectFirmwareUpdateDetectStatus({
      connectId,
      persistedStatus,
      snapshot,
    });
  }, [connectId, persistedStatus, snapshot]);
}
