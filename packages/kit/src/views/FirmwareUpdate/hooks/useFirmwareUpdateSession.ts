import { useCallback, useEffect, useMemo } from 'react';

import { useFirmwareUpdateProjectionAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';
import type {
  IFirmwareUpdateProjection,
  IFirmwareUpdateSessionStartInput,
  IFirmwareUpdateSessionStartResult,
} from '@onekeyhq/shared/types/firmwareUpdate';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export const getFirmwareUpdateSessionStartInput = (
  result: ICheckAllFirmwareReleaseResult,
): IFirmwareUpdateSessionStartInput | undefined => {
  if (!result.originalConnectId) return undefined;
  return {
    connectId: result.originalConnectId,
    updateType:
      result.updateInfos.firmware?.hasUpgrade ||
      result.updateInfos.bootloader?.hasUpgrade
        ? 'firmware'
        : 'ble',
    ...(result.updateInfos.firmware?.toFirmwareType
      ? { firmwareType: result.updateInfos.firmware.toFirmwareType }
      : {}),
    confirmations: {
      backuped: true,
      usbConnected: true,
    },
  };
};

export type IFirmwareUpdateSessionService = {
  getFirmwareUpdateProjection: (input: {
    broadcast: boolean;
  }) => Promise<IFirmwareUpdateProjection | undefined>;
  startFirmwareUpdateSession: (
    input: IFirmwareUpdateSessionStartInput,
  ) => Promise<IFirmwareUpdateSessionStartResult>;
  executeFirmwareUpdateTransaction: (input: {
    sessionId: string;
    connectId: string;
  }) => Promise<unknown>;
  resumeFirmwareUpdateTransaction: (input: {
    sessionId: string;
    connectId: string;
  }) => Promise<unknown>;
  cancelFirmwareUpdateTransaction: (input: {
    sessionId: string;
  }) => Promise<unknown>;
};

export const createFirmwareUpdateSessionActions = ({
  service,
  isTransactionPlatform,
}: {
  service: IFirmwareUpdateSessionService;
  isTransactionPlatform: boolean;
}) => ({
  refresh: async () => {
    if (!isTransactionPlatform) return undefined;
    return service.getFirmwareUpdateProjection({ broadcast: true });
  },
  start: async (
    input: IFirmwareUpdateSessionStartInput,
  ): Promise<IFirmwareUpdateSessionStartResult> => {
    if (!isTransactionPlatform) {
      return {
        engine: 'legacy',
        reason: 'sdk_managed_platform',
      };
    }
    return service.startFirmwareUpdateSession(input);
  },
  execute: async ({
    sessionId,
    connectId,
  }: {
    sessionId: string;
    connectId: string;
  }) =>
    service.executeFirmwareUpdateTransaction({
      sessionId,
      connectId,
    }),
  resume: async ({
    sessionId,
    connectId,
  }: {
    sessionId: string;
    connectId: string;
  }) =>
    service.resumeFirmwareUpdateTransaction({
      sessionId,
      connectId,
    }),
  requestExit: async (sessionId: string) =>
    service.cancelFirmwareUpdateTransaction({ sessionId }),
});

export function useFirmwareUpdateSession({
  refreshOnMount = true,
}: {
  refreshOnMount?: boolean;
} = {}) {
  const [projection] = useFirmwareUpdateProjectionAtom();
  const isTransactionPlatform = Boolean(
    platformEnv.isNative || platformEnv.isDesktop,
  );
  const actions = useMemo(
    () =>
      createFirmwareUpdateSessionActions({
        service: backgroundApiProxy.serviceFirmwareUpdate,
        isTransactionPlatform,
      }),
    [isTransactionPlatform],
  );

  const refresh = useCallback(() => actions.refresh(), [actions]);

  useEffect(() => {
    if (refreshOnMount) {
      void refresh();
    }
  }, [refresh, refreshOnMount]);

  return {
    projection,
    isTransactionPlatform,
    refresh,
    start: actions.start,
    execute: actions.execute,
    resume: actions.resume,
    requestExit: actions.requestExit,
  };
}
