/** @jest-environment jsdom */

import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';
import { act, renderHook } from '@testing-library/react';

import { Dialog, resetModalRouteByName } from '@onekeyhq/components';
import { DOWNLOAD_DESKTOP_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalFirmwareUpdateRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import { usePrepareUSBConnectForFirmwareUpdate } from '../../Onboardingv2/hooks/usePrepareUSBConnectForFirmwareUpdate';

import { bootloaderModeDialogManager } from './bootloaderModeDialogManager';
import { useFirmwareUpdateActions } from './useFirmwareUpdateActions';

import type { SearchDevice } from '@onekeyfe/hd-core';

let mockIsNative = false;
const mockPushModal = jest.fn<void, [string, unknown]>();
const mockCheckDeviceReachable = jest.fn<
  Promise<string>,
  [{ connectId: string }]
>();
const mockOpenUrlExternal = jest.fn<void, [string]>();
const mockDetectUSBDeviceAvailability = jest.fn<Promise<boolean>, [unknown]>();
const mockSetForceTransportType = jest.fn<Promise<void>, [unknown]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('use-debounce', () => ({
  useThrottledCallback: (callback: unknown) => callback,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isDesktop() {
      return !mockIsNative;
    },
    get isNative() {
      return mockIsNative;
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: (url: string) => mockOpenUrlExternal(url),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    confirm: jest.fn(),
    show: jest.fn(),
  },
  resetModalRouteByName: jest.fn(),
  resetToRoute: jest.fn(),
  rootNavigationRef: { current: null },
}));

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    push: jest.fn(),
    pushModal: (route: string, params: unknown) => mockPushModal(route, params),
  }),
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      openExtensionExpandTab: jest.fn(),
    },
    serviceHardware: {
      checkDeviceReachableForFirmwareUpdate: (params: { connectId: string }) =>
        mockCheckDeviceReachable(params),
      detectUSBDeviceAvailability: (params: unknown) =>
        mockDetectUSBDeviceAvailability(params),
      getCurrentForceTransportType: jest.fn(async () => undefined),
      setForceTransportType: (params: unknown) =>
        mockSetForceTransportType(params),
    },
  },
}));

jest.mock('../components/FirmwareUpdateCheckList', () => ({
  FirmwareUpdateCheckList: () => null,
}));

jest.mock('../utils', () => ({
  getTargetFirmwareTypeLabel: () => '',
  getFirmwareUpdateUSBPreflightParams: jest.fn(async () => ({
    connectId: 'CLASSIC_USB_PATH',
    connectProtocol: 'V1',
    bootloaderRecoveryDeviceType: 'classic1s',
  })),
}));

jest.mock('../../Onboardingv2/utils', () => ({
  getDesktopForceUSBTransportType: jest.fn(async () => 'webusb'),
}));

jest.mock('./bootloaderModeDialogManager', () => ({
  bootloaderModeDialogManager: {
    show: jest.fn(),
    close: jest.fn(async () => {}),
  },
}));

type IDialogShowProps = Parameters<typeof Dialog.show>[0];

const mockDialogShow = Dialog.show as jest.MockedFunction<typeof Dialog.show>;

function dialogProps(index: number): IDialogShowProps {
  return mockDialogShow.mock.calls[index][0];
}

function lastDialogProps(): IDialogShowProps {
  return dialogProps(mockDialogShow.mock.calls.length - 1);
}

// A macrotask boundary, so every pending continuation has run before a
// "did not continue" assertion is made.
async function settle() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

// The Bluetooth button is the dialog's cancel button: DialogFrame hands the
// handler a close that reports the 'cancel' flag.
async function continueViaBluetooth() {
  const props = lastDialogProps();
  await act(async () => {
    props.onCancel?.(async () => {
      await props.onClose?.({ flag: 'cancel' });
    });
  });
  await settle();
}

// The close button, backdrop and back key close without going through any
// button handler.
async function dismissSuggestion(extra?: { flag?: string }) {
  await act(async () => {
    await lastDialogProps().onClose?.(extra);
  });
  await settle();
}

// The 1.0.3 resource refresh of the Pro 2 family; a routine update is a few MB.
const LARGE_UPDATE_BYTES = 22_000_000;
const ROUTINE_UPDATE_BYTES = 2_500_000;
function knownLargeUpdate(deviceType: EDeviceType = EDeviceType.Pro2) {
  return { deviceType, estimatedTransferBytes: LARGE_UPDATE_BYTES };
}

// toHaveBeenCalledWith uses recursive equality, which ignores undefined
// properties; the flag's absence is asserted separately where it matters.
function changeLogRoute(params: {
  connectId: string;
  usbSuggestionAcknowledged?: true;
}) {
  return {
    screen: EModalFirmwareUpdateRoutes.ChangeLog,
    params: {
      connectId: params.connectId,
      firmwareType: undefined,
      baseReleaseInfo: undefined,
      ...(params.usbSuggestionAcknowledged
        ? { usbSuggestionAcknowledged: true }
        : {}),
    },
  };
}

function lastPushedChangeLogParams() {
  const { calls } = mockPushModal.mock;
  const route = calls[calls.length - 1][1] as { params: object };
  return route.params;
}

describe('useFirmwareUpdateActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNative = false;
    mockCheckDeviceReachable.mockImplementation(
      async ({ connectId }) => `${connectId}-resolved`,
    );
  });

  it('closes the whole firmware update modal', () => {
    const { result } = renderHook(() => useFirmwareUpdateActions());

    act(() => {
      result.current.closeUpdateModal();
    });

    expect(resetModalRouteByName).toHaveBeenCalledWith(
      EModalRoutes.FirmwareUpdateModal,
    );
  });

  describe('openChangeLogModal', () => {
    it.each([false, true])(
      'shows a silent device-not-found failure and permits retry (page host: %s)',
      async (usePageHost) => {
        mockCheckDeviceReachable.mockRejectedValueOnce({
          $isHardwareError: true,
          code: HardwareErrorCode.DeviceNotFound,
        });
        const show = jest.fn();
        const { result } = renderHook(() => useFirmwareUpdateActions());
        const params = {
          connectId: 'CLASSIC_SERIAL',
          ...(usePageHost ? { dialogHost: { show } } : {}),
        };
        await act(async () => {
          await result.current.openChangeLogModal(params);
        });
        expect(usePageHost ? show : mockDialogShow).toHaveBeenCalledWith(
          expect.objectContaining({
            description: ETranslations.hardware_device_not_find_error,
            showCancelButton: false,
          }),
        );
        expect(mockPushModal).not.toHaveBeenCalled();
        await act(async () => {
          await result.current.openChangeLogModal(params);
        });
        expect(mockPushModal).toHaveBeenCalledWith(
          EModalRoutes.FirmwareUpdateModal,
          changeLogRoute({ connectId: 'CLASSIC_SERIAL-resolved' }),
        );
      },
    );

    it.each([
      HardwareErrorCode.ActionCancelled,
      HardwareErrorCode.PinCancelled,
    ])('keeps a cancelled entry silent (%s)', async (code) => {
      mockCheckDeviceReachable.mockRejectedValueOnce({
        $isHardwareError: true,
        code,
      });
      const { result } = renderHook(() => useFirmwareUpdateActions());
      await act(async () => {
        await result.current.openChangeLogModal({
          connectId: 'CLASSIC_SERIAL',
        });
      });
      expect(mockDialogShow).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
    });

    it('checks the device and opens the changelog when the update is not known yet', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());

      await act(async () => {
        await result.current.openChangeLogModal({ connectId: 'ble-1' });
      });

      expect(mockDialogShow).not.toHaveBeenCalled();
      expect(mockCheckDeviceReachable).toHaveBeenCalledWith({
        connectId: 'ble-1',
      });
      expect(mockPushModal).toHaveBeenCalledTimes(1);
      expect(mockPushModal).toHaveBeenCalledWith(
        EModalRoutes.FirmwareUpdateModal,
        changeLogRoute({ connectId: 'ble-1-resolved' }),
      );
      expect(lastPushedChangeLogParams()).not.toHaveProperty(
        'usbSuggestionAcknowledged',
      );
    });

    it.each([EDeviceType.Pro, EDeviceType.Pro2, EDeviceType.Neo])(
      'suggests desktop USB for a large %s update on mobile before reaching the device',
      async (deviceType) => {
        mockIsNative = true;
        const { result } = renderHook(() => useFirmwareUpdateActions());

        let opening: Promise<void> | undefined;
        act(() => {
          opening = result.current.openChangeLogModal({
            connectId: 'ble-1',
            knownUpdate: knownLargeUpdate(deviceType),
          });
        });

        expect(mockDialogShow).toHaveBeenCalledTimes(1);
        expect(mockCheckDeviceReachable).not.toHaveBeenCalled();
        expect(mockPushModal).not.toHaveBeenCalled();

        await continueViaBluetooth();
        await act(async () => {
          await opening;
        });

        expect(mockCheckDeviceReachable).toHaveBeenCalledWith({
          connectId: 'ble-1',
        });
        expect(mockPushModal).toHaveBeenCalledTimes(1);
        expect(mockPushModal).toHaveBeenCalledWith(
          EModalRoutes.FirmwareUpdateModal,
          changeLogRoute({
            connectId: 'ble-1-resolved',
            usbSuggestionAcknowledged: true,
          }),
        );
      },
    );

    it('closes the suggestion before opening the desktop download page', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());

      let opening: Promise<void> | undefined;
      act(() => {
        opening = result.current.openChangeLogModal({
          connectId: 'ble-1',
          knownUpdate: knownLargeUpdate(),
        });
      });
      const props = lastDialogProps();
      // The dialog's close resolves only after its teardown has run onClose;
      // the browser must not be asked for before that, or on iOS it would be
      // presented underneath the still-mounted dialog.
      const order: string[] = [];
      mockOpenUrlExternal.mockImplementationOnce(() => {
        order.push('browser');
      });
      const close = jest.fn(async () => {
        order.push('closing');
        await props.onClose?.({ flag: 'confirm' });
        order.push('closed');
      });
      await act(async () => {
        await props.onConfirm?.({
          close,
          preventClose: jest.fn(),
          getForm: () => undefined,
          isExist: () => true,
        });
      });
      await act(async () => {
        await opening;
      });

      expect(order).toEqual(['closing', 'closed', 'browser']);
      expect(mockOpenUrlExternal).toHaveBeenCalledWith(
        DOWNLOAD_DESKTOP_APP_URL,
      );
      // Choosing the desktop app is not a Bluetooth update.
      expect(mockCheckDeviceReachable).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
    });

    it('never reaches the device when the suggestion is dismissed', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());

      let opening: Promise<void> | undefined;
      act(() => {
        opening = result.current.openChangeLogModal({
          connectId: 'ble-1',
          knownUpdate: knownLargeUpdate(),
        });
      });
      await dismissSuggestion();
      await act(async () => {
        await opening;
      });

      expect(mockCheckDeviceReachable).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
    });

    it.each([
      {
        label: 'a routine update',
        isNative: true,
        knownUpdate: {
          deviceType: EDeviceType.Pro2,
          estimatedTransferBytes: ROUTINE_UPDATE_BYTES,
        },
      },
      {
        label: 'an update the entry cannot size (the page asks later)',
        isNative: true,
        knownUpdate: {
          deviceType: EDeviceType.Pro2,
          estimatedTransferBytes: undefined,
        },
      },
      {
        label: 'a model that updates quickly over Bluetooth',
        isNative: true,
        knownUpdate: knownLargeUpdate(EDeviceType.Classic1s),
      },
      {
        label: 'any update off mobile',
        isNative: false,
        knownUpdate: knownLargeUpdate(),
      },
    ])(
      'goes straight to the device for $label',
      async ({ isNative, knownUpdate }) => {
        mockIsNative = isNative;
        const { result } = renderHook(() => useFirmwareUpdateActions());

        await act(async () => {
          await result.current.openChangeLogModal({
            connectId: 'ble-1',
            knownUpdate,
          });
        });

        expect(mockDialogShow).not.toHaveBeenCalled();
        expect(mockPushModal).toHaveBeenCalledWith(
          EModalRoutes.FirmwareUpdateModal,
          changeLogRoute({ connectId: 'ble-1-resolved' }),
        );
        expect(lastPushedChangeLogParams()).not.toHaveProperty(
          'usbSuggestionAcknowledged',
        );
      },
    );

    it('ignores a second tap while the suggestion is open', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());
      const open = () =>
        result.current.openChangeLogModal({
          connectId: 'ble-1',
          knownUpdate: knownLargeUpdate(),
        });

      let first: Promise<void> | undefined;
      let second: Promise<void> | undefined;
      act(() => {
        first = open();
        second = open();
      });
      expect(mockDialogShow).toHaveBeenCalledTimes(1);

      await continueViaBluetooth();
      await act(async () => {
        await Promise.all([first, second]);
      });

      expect(mockPushModal).toHaveBeenCalledTimes(1);
    });

    it('does not open the suggestion for an entry that is already gone', async () => {
      mockIsNative = true;
      const { result, unmount } = renderHook(() => useFirmwareUpdateActions());
      const { openChangeLogModal } = result.current;

      // Onboarding prepares the transport before it asks, and the page can be
      // left meanwhile. Its cleanup has run by then, so nothing would close a
      // dialog opened now.
      unmount();
      act(() => {
        void openChangeLogModal({
          connectId: 'ble-1',
          knownUpdate: knownLargeUpdate(),
        });
      });
      await settle();

      expect(mockDialogShow).not.toHaveBeenCalled();
      expect(mockCheckDeviceReachable).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
    });

    it('shows the suggestion through the page dialog host and closes it with the page', async () => {
      mockIsNative = true;
      const close = jest.fn();
      let hostProps: IDialogShowProps | undefined;
      const hostShow = jest.fn((props: IDialogShowProps) => {
        hostProps = props;
        return { close, getForm: () => undefined, isExist: () => true };
      });
      const { result, unmount } = renderHook(() => useFirmwareUpdateActions());

      let opening: Promise<void> | undefined;
      act(() => {
        opening = result.current.openChangeLogModal({
          connectId: 'ble-1',
          knownUpdate: knownLargeUpdate(),
          dialogHost: { show: hostShow },
        });
      });
      expect(hostShow).toHaveBeenCalledTimes(1);
      expect(mockDialogShow).not.toHaveBeenCalled();

      unmount();
      expect(close).toHaveBeenCalledTimes(1);

      // A confirm that was already on its way must not continue either.
      await act(async () => {
        hostProps?.onCancel?.(async () => {
          await hostProps?.onClose?.({ flag: 'cancel' });
        });
        await opening;
      });

      expect(mockCheckDeviceReachable).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
    });
  });

  describe('showForceUpdate', () => {
    it('opens the changelog without a suggestion; the page sizes the update', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());

      act(() => {
        result.current.showForceUpdate({ connectId: 'ble-1' });
      });
      expect(mockDialogShow).toHaveBeenCalledTimes(1);

      await act(async () => {
        await dialogProps(0).onConfirm?.({
          close: jest.fn(),
          preventClose: () => {},
          getForm: () => undefined,
          isExist: () => true,
        });
      });

      expect(mockDialogShow).toHaveBeenCalledTimes(1);
      expect(mockPushModal).toHaveBeenCalledWith(
        EModalRoutes.FirmwareUpdateModal,
        changeLogRoute({ connectId: 'ble-1-resolved' }),
      );
      expect(lastPushedChangeLogParams()).not.toHaveProperty(
        'usbSuggestionAcknowledged',
      );
    });
  });
});

describe('bootloader update USB preparation', () => {
  const device = {
    connectId: 'CLASSIC_USB_PATH',
    deviceType: EDeviceType.Classic1s,
  } as SearchDevice;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNative = false;
    mockDetectUSBDeviceAvailability.mockReset();
    mockSetForceTransportType.mockResolvedValue(undefined);
    mockCheckDeviceReachable.mockImplementation(
      async ({ connectId }) => `${connectId}-resolved`,
    );
  });

  it('explains the multi-USB block and allows the update after unplugging the other device', async () => {
    mockDetectUSBDeviceAvailability
      .mockRejectedValueOnce({
        $isHardwareError: true,
        code: HardwareErrorCode.FirmwareUpdateLimitOneDevice,
      })
      .mockResolvedValue(true);
    const { result } = renderHook(() => ({
      actions: useFirmwareUpdateActions(),
      usb: usePrepareUSBConnectForFirmwareUpdate(),
    }));
    act(() =>
      result.current.actions.showBootloaderMode({
        connectId: device.connectId ?? undefined,
        existsFirmware: true,
        onBeforeUpdate: async () =>
          (
            await result.current.usb.prepareUSBConnect({
              device,
              features: undefined,
            })
          )?.connectId,
      }),
    );
    const update = jest.mocked(bootloaderModeDialogManager).show.mock
      .calls[0][0].onUpdate;
    await act(async () => {
      await update();
    });
    expect(mockDialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          ETranslations.update_only_one_usb_device_supported_for_upgrade,
        showCancelButton: false,
      }),
    );
    expect(mockSetForceTransportType).not.toHaveBeenCalled();
    expect(mockCheckDeviceReachable).not.toHaveBeenCalled();
    expect(mockPushModal).not.toHaveBeenCalled();

    await act(async () => {
      await update();
    });
    expect(mockDetectUSBDeviceAvailability).toHaveBeenCalledTimes(2);
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    expect(mockSetForceTransportType).toHaveBeenCalledWith({
      forceTransportType: 'webusb',
    });
    expect(mockPushModal).toHaveBeenCalledWith(
      EModalRoutes.FirmwareUpdateModal,
      changeLogRoute({ connectId: 'CLASSIC_USB_PATH-resolved' }),
    );
  });

  it('preserves unrelated USB preflight errors', async () => {
    const error = new Error('USB disconnected');
    mockDetectUSBDeviceAvailability.mockRejectedValue(error);
    const { result } = renderHook(() =>
      usePrepareUSBConnectForFirmwareUpdate(),
    );
    await expect(
      result.current.prepareUSBConnect({ device, features: undefined }),
    ).rejects.toBe(error);
    expect(mockDialogShow).not.toHaveBeenCalled();
    expect(mockSetForceTransportType).not.toHaveBeenCalled();
  });
});
