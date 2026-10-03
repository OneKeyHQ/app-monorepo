/** @jest-environment jsdom */

import { EDeviceType } from '@onekeyfe/hd-shared';
import { act, renderHook } from '@testing-library/react';

import { Dialog, resetModalRouteByName } from '@onekeyhq/components';
import { DOWNLOAD_DESKTOP_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import {
  EModalFirmwareUpdateRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import { useFirmwareUpdateActions } from './useFirmwareUpdateActions';

let mockIsNative = false;
const mockPushModal = jest.fn<void, [string, unknown]>();
const mockCheckDeviceReachable = jest.fn<
  Promise<string>,
  [{ connectId: string }]
>();
const mockOpenUrlExternal = jest.fn<void, [string]>();
const mockGetDeviceByConnectId = jest.fn<
  Promise<{ deviceType: EDeviceType } | undefined>,
  [{ connectId: string }]
>();

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
      getDeviceByConnectId: (params: { connectId: string }) =>
        mockGetDeviceByConnectId(params),
    },
  },
}));

jest.mock('../components/FirmwareUpdateCheckList', () => ({
  FirmwareUpdateCheckList: () => null,
}));

jest.mock('../utils', () => ({
  getTargetFirmwareTypeLabel: () => '',
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
    mockGetDeviceByConnectId.mockResolvedValue(undefined);
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
    it('checks the device and opens the changelog when the update is not known yet', async () => {
      mockIsNative = true;
      mockGetDeviceByConnectId.mockResolvedValue({
        deviceType: EDeviceType.Pro2,
      });
      const { result } = renderHook(() => useFirmwareUpdateActions());

      await act(async () => {
        await result.current.openChangeLogModal({ connectId: 'ble-1' });
      });

      expect(mockDialogShow).not.toHaveBeenCalled();
      expect(mockGetDeviceByConnectId).not.toHaveBeenCalled();
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
      'suggests desktop USB to %s owners on mobile before reaching the device',
      async (deviceType) => {
        mockIsNative = true;
        const { result } = renderHook(() => useFirmwareUpdateActions());

        let opening: Promise<void> | undefined;
        act(() => {
          opening = result.current.openChangeLogModal({
            connectId: 'ble-1',
            suggestDesktopUsbFirst: true,
            deviceType,
          });
        });

        expect(mockDialogShow).toHaveBeenCalledTimes(1);
        expect(mockGetDeviceByConnectId).not.toHaveBeenCalled();
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

    it('names the model from the local device record when the entry has none', async () => {
      mockIsNative = true;
      mockGetDeviceByConnectId.mockResolvedValue({
        deviceType: EDeviceType.Neo,
      });
      const { result } = renderHook(() => useFirmwareUpdateActions());

      let opening: Promise<void> | undefined;
      act(() => {
        opening = result.current.openChangeLogModal({
          connectId: 'ble-1',
          suggestDesktopUsbFirst: true,
        });
      });
      await settle();

      expect(mockGetDeviceByConnectId).toHaveBeenCalledWith({
        connectId: 'ble-1',
      });
      expect(mockDialogShow).toHaveBeenCalledTimes(1);
      expect(mockCheckDeviceReachable).not.toHaveBeenCalled();

      await continueViaBluetooth();
      await act(async () => {
        await opening;
      });

      expect(mockPushModal).toHaveBeenCalledWith(
        EModalRoutes.FirmwareUpdateModal,
        changeLogRoute({
          connectId: 'ble-1-resolved',
          usbSuggestionAcknowledged: true,
        }),
      );
    });

    it('leaves the question to the changelog page when no record names the model', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());

      await act(async () => {
        await result.current.openChangeLogModal({
          connectId: 'ble-1',
          suggestDesktopUsbFirst: true,
        });
      });

      expect(mockGetDeviceByConnectId).toHaveBeenCalledWith({
        connectId: 'ble-1',
      });
      expect(mockDialogShow).not.toHaveBeenCalled();
      expect(mockPushModal).toHaveBeenCalledWith(
        EModalRoutes.FirmwareUpdateModal,
        changeLogRoute({ connectId: 'ble-1-resolved' }),
      );
      expect(lastPushedChangeLogParams()).not.toHaveProperty(
        'usbSuggestionAcknowledged',
      );
    });

    it('shows the suggestion through the dialog host the page provides', async () => {
      mockIsNative = true;
      const hostShow = jest.fn();
      const { result } = renderHook(() => useFirmwareUpdateActions());

      act(() => {
        void result.current.openChangeLogModal({
          connectId: 'ble-1',
          suggestDesktopUsbFirst: true,
          deviceType: EDeviceType.Pro2,
          dialogHost: { show: hostShow },
        });
      });

      expect(hostShow).toHaveBeenCalledTimes(1);
      expect(mockDialogShow).not.toHaveBeenCalled();
    });

    it('opens the desktop download page and keeps the suggestion open', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());

      let opening: Promise<void> | undefined;
      act(() => {
        opening = result.current.openChangeLogModal({
          connectId: 'ble-1',
          suggestDesktopUsbFirst: true,
          deviceType: EDeviceType.Pro2,
        });
      });
      const preventClose = jest.fn();
      const close = jest.fn();
      await act(async () => {
        await lastDialogProps().onConfirm?.({
          close,
          preventClose,
          getForm: () => undefined,
          isExist: () => true,
        });
      });
      await settle();

      expect(mockOpenUrlExternal).toHaveBeenCalledWith(
        DOWNLOAD_DESKTOP_APP_URL,
      );
      expect(preventClose).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(mockCheckDeviceReachable).not.toHaveBeenCalled();

      // Back from the browser, Bluetooth is still available.
      await continueViaBluetooth();
      await act(async () => {
        await opening;
      });
      expect(mockPushModal).toHaveBeenCalledTimes(1);
    });

    it('never reaches the device when the suggestion is dismissed', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());

      let opening: Promise<void> | undefined;
      act(() => {
        opening = result.current.openChangeLogModal({
          connectId: 'ble-1',
          suggestDesktopUsbFirst: true,
          deviceType: EDeviceType.Pro2,
        });
      });
      await dismissSuggestion();
      await act(async () => {
        await opening;
      });

      expect(mockCheckDeviceReachable).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
    });

    it('skips the suggestion for models that update quickly over Bluetooth', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());

      await act(async () => {
        await result.current.openChangeLogModal({
          connectId: 'ble-1',
          suggestDesktopUsbFirst: true,
          deviceType: EDeviceType.Classic1s,
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
    });

    it('skips the suggestion and the record lookup off mobile', async () => {
      const { result } = renderHook(() => useFirmwareUpdateActions());

      await act(async () => {
        await result.current.openChangeLogModal({
          connectId: 'usb-1',
          suggestDesktopUsbFirst: true,
        });
      });

      expect(mockGetDeviceByConnectId).not.toHaveBeenCalled();
      expect(mockDialogShow).not.toHaveBeenCalled();
      expect(mockPushModal).toHaveBeenCalledWith(
        EModalRoutes.FirmwareUpdateModal,
        changeLogRoute({ connectId: 'usb-1-resolved' }),
      );
      expect(lastPushedChangeLogParams()).not.toHaveProperty(
        'usbSuggestionAcknowledged',
      );
    });

    it('ignores a second tap while the suggestion is open', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());
      const open = () =>
        result.current.openChangeLogModal({
          connectId: 'ble-1',
          suggestDesktopUsbFirst: true,
          deviceType: EDeviceType.Pro2,
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

    it('does not open a suggestion for an entry that unmounted during the record lookup', async () => {
      mockIsNative = true;
      let releaseLookup: (() => void) | undefined;
      mockGetDeviceByConnectId.mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseLookup = () => resolve({ deviceType: EDeviceType.Pro2 });
          }),
      );
      const { result, unmount } = renderHook(() => useFirmwareUpdateActions());

      let opening: Promise<void> | undefined;
      act(() => {
        opening = result.current.openChangeLogModal({
          connectId: 'ble-1',
          suggestDesktopUsbFirst: true,
        });
      });
      unmount();
      await act(async () => {
        releaseLookup?.();
        await opening;
      });

      expect(mockDialogShow).not.toHaveBeenCalled();
      expect(mockCheckDeviceReachable).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
    });

    it('closes the suggestion with its host and does not continue', async () => {
      mockIsNative = true;
      const close = jest.fn();
      mockDialogShow.mockReturnValueOnce({
        close,
        getForm: () => undefined,
        isExist: () => true,
      });
      const { result, unmount } = renderHook(() => useFirmwareUpdateActions());

      let opening: Promise<void> | undefined;
      act(() => {
        opening = result.current.openChangeLogModal({
          connectId: 'ble-1',
          suggestDesktopUsbFirst: true,
          deviceType: EDeviceType.Pro2,
        });
      });
      unmount();
      expect(close).toHaveBeenCalledTimes(1);

      // A confirm that was already on its way must not continue either.
      await continueViaBluetooth();
      await act(async () => {
        await opening;
      });

      expect(mockCheckDeviceReachable).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
    });
  });

  describe('showForceUpdate', () => {
    it('closes its own dialog before the suggestion, then opens the changelog', async () => {
      mockIsNative = true;
      mockGetDeviceByConnectId.mockResolvedValue({
        deviceType: EDeviceType.Pro2,
      });
      const { result } = renderHook(() => useFirmwareUpdateActions());

      act(() => {
        result.current.showForceUpdate({ connectId: 'ble-1' });
      });
      expect(mockDialogShow).toHaveBeenCalledTimes(1);

      let releaseClose: (() => void) | undefined;
      const close = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseClose = resolve;
          }),
      );
      let confirming: Promise<void> | void;
      act(() => {
        confirming = dialogProps(0).onConfirm?.({
          close,
          preventClose: () => {},
          getForm: () => undefined,
          isExist: () => true,
        });
      });
      await settle();

      // Still waiting for the force dialog to leave the overlay.
      expect(close).toHaveBeenCalledTimes(1);
      expect(mockDialogShow).toHaveBeenCalledTimes(1);

      await act(async () => {
        releaseClose?.();
      });
      await settle();

      expect(mockDialogShow).toHaveBeenCalledTimes(2);
      expect(mockCheckDeviceReachable).not.toHaveBeenCalled();

      await continueViaBluetooth();
      await act(async () => {
        await confirming;
      });

      expect(mockPushModal).toHaveBeenCalledWith(
        EModalRoutes.FirmwareUpdateModal,
        changeLogRoute({
          connectId: 'ble-1-resolved',
          usbSuggestionAcknowledged: true,
        }),
      );
    });
  });
});
