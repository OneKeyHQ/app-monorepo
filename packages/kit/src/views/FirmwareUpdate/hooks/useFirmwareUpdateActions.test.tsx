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

    it.each([EDeviceType.Pro2, EDeviceType.Neo])(
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

    it('lets a routine update go straight to the device', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());

      await act(async () => {
        await result.current.openChangeLogModal({
          connectId: 'ble-1',
          knownUpdate: {
            deviceType: EDeviceType.Pro2,
            estimatedTransferBytes: ROUTINE_UPDATE_BYTES,
          },
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

    it('leaves the question to the changelog page when the entry cannot size the update', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());

      await act(async () => {
        await result.current.openChangeLogModal({
          connectId: 'ble-1',
          knownUpdate: {
            deviceType: EDeviceType.Pro2,
            estimatedTransferBytes: undefined,
          },
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

    it('shows the suggestion through the dialog host the page provides', async () => {
      mockIsNative = true;
      const hostShow = jest.fn();
      const { result } = renderHook(() => useFirmwareUpdateActions());

      act(() => {
        void result.current.openChangeLogModal({
          connectId: 'ble-1',
          knownUpdate: knownLargeUpdate(),
          dialogHost: { show: hostShow },
        });
      });

      expect(hostShow).toHaveBeenCalledTimes(1);
      expect(mockDialogShow).not.toHaveBeenCalled();
    });

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

    it.each([EDeviceType.Pro, EDeviceType.Classic1s])(
      'skips the suggestion for %s whatever the size',
      async (deviceType) => {
        mockIsNative = true;
        const { result } = renderHook(() => useFirmwareUpdateActions());

        await act(async () => {
          await result.current.openChangeLogModal({
            connectId: 'ble-1',
            knownUpdate: knownLargeUpdate(deviceType),
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

    it('skips the suggestion off mobile', async () => {
      const { result } = renderHook(() => useFirmwareUpdateActions());

      await act(async () => {
        await result.current.openChangeLogModal({
          connectId: 'usb-1',
          knownUpdate: knownLargeUpdate(),
        });
      });

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
          knownUpdate: knownLargeUpdate(),
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
