/** @jest-environment jsdom */

import { EDeviceType } from '@onekeyfe/hd-shared';
import { act, renderHook } from '@testing-library/react';

import { Dialog, resetModalRouteByName } from '@onekeyhq/components';
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
  },
}));

type IDialogShowProps = Parameters<typeof Dialog.show>[0];

const mockDialogShow = Dialog.show as jest.MockedFunction<typeof Dialog.show>;

function lastDialogProps(): IDialogShowProps {
  const { calls } = mockDialogShow.mock;
  return calls[calls.length - 1][0];
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

async function closeSuggestion(extra?: { flag?: string }) {
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
    it('checks the device and opens the changelog when no model is passed', async () => {
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
      'suggests desktop USB to %s owners on mobile before reaching the device',
      async (deviceType) => {
        mockIsNative = true;
        const { result } = renderHook(() => useFirmwareUpdateActions());

        let opening: Promise<void> | undefined;
        act(() => {
          opening = result.current.openChangeLogModal({
            connectId: 'ble-1',
            suggestDesktopUsbForDeviceType: deviceType,
          });
        });

        expect(mockDialogShow).toHaveBeenCalledTimes(1);
        expect(mockCheckDeviceReachable).not.toHaveBeenCalled();
        expect(mockPushModal).not.toHaveBeenCalled();

        await closeSuggestion({ flag: 'confirm' });
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

    it('never reaches the device when the suggestion is dismissed', async () => {
      mockIsNative = true;
      const { result } = renderHook(() => useFirmwareUpdateActions());

      let opening: Promise<void> | undefined;
      act(() => {
        opening = result.current.openChangeLogModal({
          connectId: 'ble-1',
          suggestDesktopUsbForDeviceType: EDeviceType.Pro2,
        });
      });
      await closeSuggestion();
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
          suggestDesktopUsbForDeviceType: EDeviceType.Classic1s,
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

    it('skips the suggestion off mobile', async () => {
      const { result } = renderHook(() => useFirmwareUpdateActions());

      await act(async () => {
        await result.current.openChangeLogModal({
          connectId: 'usb-1',
          suggestDesktopUsbForDeviceType: EDeviceType.Pro2,
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
          suggestDesktopUsbForDeviceType: EDeviceType.Pro2,
        });

      let first: Promise<void> | undefined;
      let second: Promise<void> | undefined;
      act(() => {
        first = open();
        second = open();
      });
      expect(mockDialogShow).toHaveBeenCalledTimes(1);

      await closeSuggestion({ flag: 'confirm' });
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
          suggestDesktopUsbForDeviceType: EDeviceType.Pro2,
        });
      });
      unmount();
      expect(close).toHaveBeenCalledTimes(1);

      // A confirm that was already on its way must not continue either.
      await closeSuggestion({ flag: 'confirm' });
      await act(async () => {
        await opening;
      });

      expect(mockCheckDeviceReachable).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
    });
  });
});
