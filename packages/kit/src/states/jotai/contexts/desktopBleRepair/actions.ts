import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import { contextAtomMethod, desktopBleRepairAtom } from './atoms';

import type { IDesktopBleRepairData } from './atoms';

class ContextJotaiActionsDesktopBleRepair extends ContextJotaiActionsBase {
  showDesktopBleRepairDialog = contextAtomMethod(
    (get, set, data: IDesktopBleRepairData) => {
      set(desktopBleRepairAtom(), {
        isVisible: true,
        data,
        isRepairing: false,
        progressStage: undefined,
        progressMessage: undefined,
      });
    },
  );

  hideDesktopBleRepairDialog = contextAtomMethod(async (get, set) => {
    const currentData = get(desktopBleRepairAtom());

    // Reject the servicePromise if exists (user cancelled)
    if (currentData.data?.promiseId) {
      await backgroundApiProxy.servicePromise.rejectCallback({
        id: currentData.data.promiseId,
        error: new Error('BLE pairing cancelled by user'),
      });
    }

    set(desktopBleRepairAtom(), {
      isVisible: false,
      data: undefined,
      isRepairing: false,
      progressStage: undefined,
      progressMessage: undefined,
    });
  });

  updateDesktopBleRepairProgress = contextAtomMethod(
    (
      get,
      set,
      payload: {
        progressStage?:
          | 'searching'
          | 'matching'
          | 'connecting'
          | 'success'
          | 'failed';
        progressMessage?: string;
      },
    ) => {
      set(desktopBleRepairAtom(), (prev) => ({
        ...prev,
        ...payload,
      }));
    },
  );

  updateDesktopBleRepairState = contextAtomMethod(
    (
      get,
      set,
      payload: {
        isRepairing?: boolean;
        progressStage?:
          | 'searching'
          | 'matching'
          | 'connecting'
          | 'success'
          | 'failed';
        progressMessage?: string;
      },
    ) => {
      set(desktopBleRepairAtom(), (prev) => ({
        ...prev,
        ...payload,
      }));
    },
  );

  startDesktopBleRepair = contextAtomMethod(
    async (get, set, data: IDesktopBleRepairData) => {
      set(desktopBleRepairAtom(), (prev) => ({
        ...prev,
        isRepairing: true,
        progressStage: undefined,
        progressMessage: undefined,
      }));

      try {
        // Call the hardware service to search and repair with progress feedback
        const repairedConnectId =
          await backgroundApiProxy.serviceHardware.repairBleConnectIdWithProgress(
            {
              connectId: data.connectId,
              featuresDeviceId: data.deviceId,
              features: data.features,
            },
          );

        if (repairedConnectId) {
          // Repair successful, resolve the servicePromise with the new connectId
          if (data.promiseId) {
            await backgroundApiProxy.servicePromise.resolveCallback({
              id: data.promiseId,
              data: repairedConnectId,
            });
          }

          // Close dialog
          set(desktopBleRepairAtom(), {
            isVisible: false,
            data: undefined,
            isRepairing: false,
            progressStage: undefined,
            progressMessage: undefined,
          });
          return true;
        }

        // Repair failed, reject the servicePromise if exists
        if (data.promiseId) {
          await backgroundApiProxy.servicePromise.rejectCallback({
            id: data.promiseId,
            error: new Error('BLE pairing failed'),
          });
        }

        // Keep dialog open but stop loading
        set(desktopBleRepairAtom(), (prev) => ({
          ...prev,
          isRepairing: false,
        }));
        return false;
      } catch (error) {
        console.error('BLE repair failed:', error);

        // Reject the servicePromise if exists
        if (data.promiseId) {
          await backgroundApiProxy.servicePromise.rejectCallback({
            id: data.promiseId,
            error: error as Error,
          });
        }

        set(desktopBleRepairAtom(), (prev) => ({
          ...prev,
          isRepairing: false,
        }));
        return false;
      }
    },
  );
}

const createActions = memoFn(() => new ContextJotaiActionsDesktopBleRepair());

export function useDesktopBleRepairActions() {
  const actions = createActions();
  const showDesktopBleRepairDialog = actions.showDesktopBleRepairDialog.use();
  const hideDesktopBleRepairDialog = actions.hideDesktopBleRepairDialog.use();
  const updateDesktopBleRepairProgress =
    actions.updateDesktopBleRepairProgress.use();
  const updateDesktopBleRepairState = actions.updateDesktopBleRepairState.use();
  const startDesktopBleRepair = actions.startDesktopBleRepair.use();

  return useRef({
    showDesktopBleRepairDialog,
    hideDesktopBleRepairDialog,
    updateDesktopBleRepairProgress,
    updateDesktopBleRepairState,
    startDesktopBleRepair,
  });
}
