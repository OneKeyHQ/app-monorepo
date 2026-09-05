import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IDBCreateHwWalletParamsBase,
  IDBDevice,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IJotaiSetter } from '@onekeyhq/kit-bg/src/states/jotai/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IAccountSelectorActionsInstance } from './actions';

const { serviceAccount } = backgroundApiProxy;

export async function updateHwWalletsDeprecatedStatus({
  connectId,
  usbConnectId,
  bleConnectId,
  deviceId,
}: {
  connectId: string;
  usbConnectId?: string;
  bleConnectId?: string;
  deviceId: string;
}) {
  if (!connectId || !deviceId) {
    return;
  }

  // Best-effort cleanup: callers run it after the wallet is already created.
  try {
    const currentConnectIds = new Set(
      [connectId, usbConnectId, bleConnectId]
        .filter((item): item is string => Boolean(item))
        .map((item) => item.toLowerCase()),
    );
    const allHwWallets = await serviceAccount.getAllHwQrWalletWithDevice({
      filterHiddenWallet: false,
      filterQrWallet: true,
    });
    const willUpdateDeprecateMap: Record<string, boolean> = {};

    for (const { wallet, device } of Object.values(allHwWallets)) {
      if (wallet?.id && device) {
        const isSameConnectId = [
          device.connectId,
          device.usbConnectId,
          device.bleConnectId,
        ]
          .filter((item): item is string => Boolean(item))
          .some((item) => currentConnectIds.has(item.toLowerCase()));
        if (isSameConnectId) {
          const deprecated = device.deviceId !== deviceId;
          if (Boolean(wallet.deprecated) !== deprecated) {
            willUpdateDeprecateMap[wallet.id] = deprecated;
          }
        }
      }
    }

    if (
      Object.keys(willUpdateDeprecateMap).length > 0 &&
      (await serviceAccount.updateWalletsDeprecatedState({
        willUpdateDeprecateMap,
      }))
    ) {
      appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    }
  } catch (error) {
    console.error('updateHwWalletsDeprecatedStatus failed:', error);
  }
}

export async function createHWWalletWithoutHidden({
  actions,
  set,
  params,
}: {
  actions: IAccountSelectorActionsInstance;
  set: IJotaiSetter;
  params: IDBCreateHwWalletParamsBase;
}) {
  let createdDevice: IDBDevice | undefined;

  return actions.withFinalizeWalletSetupStep.call(set, {
    createWalletFn: async () => {
      const { wallet, device, indexedAccount, isOverrideWallet } =
        await actions.createHWWallet.call(
          set,
          { ...params, skipDeviceCancel: true },
          { disableAutoSelect: true },
        );
      createdDevice = device;
      if (!wallet.isMocked && indexedAccount?.id) {
        await actions.autoSelectToCreatedWallet.call(set, {
          wallet,
          indexedAccount,
          isOverrideWallet,
          isAttachPinMode: params.isAttachPinMode,
        });
      }
      await serviceAccount.restoreTempCreatedWallet({ walletId: wallet.id });
      return { isOverrideWallet, wallet, indexedAccount, hidden: undefined };
    },
    generatingAccountsFn: async ({ wallet, indexedAccount }) => {
      await actions.addDefaultNetworkAccounts.call(set, {
        wallet,
        indexedAccount,
        isCreateWallet: true,
        skipDeviceCancel: false,
        hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
      });
      if (createdDevice?.connectId && createdDevice.deviceId) {
        await updateHwWalletsDeprecatedStatus({
          connectId: createdDevice.connectId,
          usbConnectId: createdDevice.usbConnectId,
          bleConnectId: createdDevice.bleConnectId,
          deviceId: createdDevice.deviceId,
        });
      }
    },
  });
}

export async function createHWWalletWithHidden({
  actions,
  set,
  params,
}: {
  actions: IAccountSelectorActionsInstance;
  set: IJotaiSetter;
  params: IDBCreateHwWalletParamsBase;
}) {
  let createdDevice: IDBDevice | undefined;

  return actions.withFinalizeWalletSetupStep.call(set, {
    createWalletFn: async () => {
      const { wallet, device, indexedAccount, isOverrideWallet } =
        await actions.createHWWallet.call(
          set,
          {
            ...params,
            isMockedStandardHwWallet: true,
            skipDeviceCancel: true,
          },
          { disableAutoSelect: true },
        );
      createdDevice = device;

      if (!device) {
        throw new OneKeyLocalError(
          'Unable to create hidden wallet without a hardware device',
        );
      }
      if (!params.hideCheckingDeviceLoading) {
        await backgroundApiProxy.serviceHardwareUI.showCheckingDeviceDialog({
          connectId: device.connectId,
        });
      }
      await timerUtils.wait(100);
      const hidden = await actions.createHWHiddenWallet.call(set, {
        walletId: wallet.id,
        skipDeviceCancel: true,
        hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
      });

      await serviceAccount.restoreTempCreatedWallet({ walletId: wallet.id });
      return {
        isOverrideWallet,
        wallet,
        indexedAccount,
        hidden: {
          wallet: hidden.wallet,
          indexedAccount: hidden.indexedAccount,
        },
      };
    },
    generatingAccountsFn: async ({ wallet, indexedAccount, hidden }) => {
      if (hidden?.wallet && hidden.indexedAccount) {
        // Create hidden accounts first to avoid repeated passphrase prompts.
        await actions.addDefaultNetworkAccounts.call(set, {
          wallet: hidden.wallet,
          indexedAccount: hidden.indexedAccount,
          isCreateWallet: true,
          skipDeviceCancel: true,
          hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
        });
        await timerUtils.wait(100);
      }
      if (wallet && indexedAccount) {
        await actions.addDefaultNetworkAccounts.call(set, {
          wallet,
          indexedAccount,
          isCreateWallet: true,
          skipDeviceCancel: false,
          hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
        });
      }
      if (hidden?.wallet && hidden.indexedAccount) {
        // Keep the hidden wallet selected before reset cleanup broadcasts.
        await actions.autoSelectToCreatedWallet.call(set, {
          wallet: hidden.wallet,
          indexedAccount: hidden.indexedAccount,
          isOverrideWallet: false,
          isAttachPinMode: params.isAttachPinMode,
        });
      }
      if (createdDevice?.connectId && createdDevice.deviceId) {
        await updateHwWalletsDeprecatedStatus({
          connectId: createdDevice.connectId,
          usbConnectId: createdDevice.usbConnectId,
          bleConnectId: createdDevice.bleConnectId,
          deviceId: createdDevice.deviceId,
        });
      }
    },
  });
}
