/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import { FirmwareUpdateTestIDs } from '../testIDs';

import { FirmwareChangeLogView } from './FirmwareChangeLogView';

let mockIsNative = true;
let mockIsDesktop = false;
const mockSetStepInfo = jest.fn();
const mockShowCheckList = jest.fn();
const mockDetectUSBDeviceAvailability = jest.fn<Promise<boolean>, [unknown]>();

jest.mock('react-intl', () => {
  const intl = { formatMessage: ({ id }: { id: string }) => id };
  return { useIntl: () => intl };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
    get isDesktop() {
      return mockIsDesktop;
    },
  },
}));

// The jest moduleNameMapper sends every `@onekeyhq/components` path, deep
// ones included, to this one module.
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Div = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', undefined, children);
  return {
    Accordion: Div,
    Alert: () => null,
    Dialog: { show: jest.fn() },
    Icon: () => null,
    Markdown: Div,
    SizableText: Div,
    Stack: Div,
    XStack: Div,
    resetModalRouteByName: jest.fn(),
    resetToRoute: jest.fn(),
    rootNavigationRef: { current: null },
  };
});

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('use-debounce', () => ({
  useThrottledCallback: (callback: unknown) => callback,
}));

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: jest.fn(), pushModal: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      detectUSBDeviceAvailability: (params: unknown) =>
        mockDetectUSBDeviceAvailability(params),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EFirmwareUpdateSteps: { showCheckList: 'showCheckList' },
  useDevSettingsPersistAtom: () => [{ enabled: false }],
  useFirmwareUpdateDevSettingsPersistAtom: () => [{}],
  useFirmwareUpdateStepInfoAtom: () => [
    { step: 'showChangeLog' },
    mockSetStepInfo,
  ],
  useSettingsPersistAtom: () => [{ locale: 'en-US' }],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    update: { firmware: { firmwareSwitchStart: jest.fn() } },
  },
}));

// The real hook owns the suggestion dialog; only the checklist is stubbed.
jest.mock('../hooks/useFirmwareUpdateActions', () => {
  const actual = jest.requireActual<
    typeof import('../hooks/useFirmwareUpdateActions')
  >('../hooks/useFirmwareUpdateActions');
  return {
    useFirmwareUpdateActions: () => ({
      ...actual.useFirmwareUpdateActions(),
      showCheckList: mockShowCheckList,
    }),
  };
});

jest.mock('../hooks/bootloaderModeDialogManager', () => ({
  bootloaderModeDialogManager: { show: jest.fn() },
}));

jest.mock('./FirmwareUpdateCheckList', () => ({
  FirmwareUpdateCheckList: () => null,
}));

jest.mock('../hooks/useFirmwareVersionValid', () => ({
  useFirmwareVersionValid: () => ({
    versionValid: (value: string) => !!value,
    unknownMessage: 'Unknown',
  }),
}));

jest.mock('../utils', () => ({
  getFirmwareUpdateUSBPreflightParams: async () => ({
    connectId: 'usb-connect-id',
    connectProtocol: undefined,
  }),
  getProtocolV2FirmwareVersionDisplayItems: () => [],
  getProtocolV2FirmwareVersionTitle: () => '',
  shouldHidePro2FirmwareDebugInfo: () => false,
}));

jest.mock('./FirmwareUpdateIntroduction', () => ({
  FirmwareUpdateIntroduction: () => null,
}));

jest.mock('./FirmwareVersionProgressBar', () => ({
  FirmwareVersionProgressText: () => null,
}));

jest.mock('./FirmwareUpdatePageLayout', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    // Like Page.Footer, the button fires the handler without awaiting it.
    FirmwareUpdatePageFooter: ({
      onConfirm,
      onConfirmText,
      confirmButtonProps,
    }: {
      onConfirm?: () => void;
      onConfirmText?: string;
      confirmButtonProps?: { testID?: string };
    }) =>
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': confirmButtonProps?.testID,
          onClick: () => onConfirm?.(),
        },
        onConfirmText,
      ),
  };
});

type IDialogShowProps = Parameters<typeof Dialog.show>[0];

const mockDialogShow = Dialog.show as jest.MockedFunction<typeof Dialog.show>;

function buildResult(deviceType: EDeviceType) {
  return { deviceType } as ICheckAllFirmwareReleaseResult;
}

function tapUpdateNow() {
  fireEvent.click(screen.getByTestId(FirmwareUpdateTestIDs.updateNowBtn));
}

function lastDialogProps(): IDialogShowProps {
  const { calls } = mockDialogShow.mock;
  return calls[calls.length - 1][0];
}

// A macrotask boundary, so every pending continuation of the click handler
// has run before a "did not advance" assertion is made.
async function settleHandlers() {
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
  await settleHandlers();
}

// The close button, backdrop and back key close without going through any
// button handler.
async function dismissSuggestion(extra?: { flag?: string }) {
  await act(async () => {
    await lastDialogProps().onClose?.(extra);
  });
  await settleHandlers();
}

describe('FirmwareChangeLogView desktop USB suggestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNative = true;
    mockIsDesktop = false;
    mockDetectUSBDeviceAvailability.mockResolvedValue(true);
  });

  it.each([EDeviceType.Pro, EDeviceType.Pro2, EDeviceType.Neo])(
    'suggests desktop USB to %s owners on mobile before the checklist',
    (deviceType) => {
      const onConfirmClick = jest.fn();
      render(
        <FirmwareChangeLogView
          result={buildResult(deviceType)}
          onConfirmClick={onConfirmClick}
        />,
      );

      tapUpdateNow();

      expect(mockDialogShow).toHaveBeenCalledTimes(1);
      expect(lastDialogProps()).toMatchObject({
        icon: 'TypeCoutline',
        title: ETranslations.firmware_update_install_page__title,
        description: ETranslations.firmware_update_usb_recommended__desc,
        onConfirmText:
          ETranslations.firmware_update_download_desktop_app__action,
        confirmButtonProps: {
          icon: 'MonitorOutline',
          testID: FirmwareUpdateTestIDs.usbSuggestionDownloadBtn,
        },
        onCancelText:
          ETranslations.firmware_update_continue_via_bluetooth__action,
        cancelButtonProps: {
          icon: 'BluetoothOutline',
          testID: FirmwareUpdateTestIDs.usbSuggestionContinueBtn,
        },
      });
      expect(mockSetStepInfo).not.toHaveBeenCalled();
      expect(mockShowCheckList).not.toHaveBeenCalled();
      expect(onConfirmClick).not.toHaveBeenCalled();
    },
  );

  it('opens the checklist once the Bluetooth button has closed the suggestion', async () => {
    const result = buildResult(EDeviceType.Pro2);
    const onConfirmClick = jest.fn();
    render(
      <FirmwareChangeLogView result={result} onConfirmClick={onConfirmClick} />,
    );

    tapUpdateNow();
    await continueViaBluetooth();

    expect(mockSetStepInfo).toHaveBeenCalledTimes(1);
    expect(mockSetStepInfo).toHaveBeenCalledWith({
      step: 'showCheckList',
      payload: undefined,
    });
    expect(mockShowCheckList).toHaveBeenCalledTimes(1);
    expect(mockShowCheckList).toHaveBeenCalledWith({ result });
    expect(onConfirmClick).toHaveBeenCalledTimes(1);
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: 'the close button, backdrop or back key', extra: undefined },
    {
      label: 'a confirm flag without the Bluetooth button',
      extra: { flag: 'confirm' },
    },
  ])(
    'stays on the changelog when the suggestion closes via $label',
    async ({ extra }) => {
      const result = buildResult(EDeviceType.Pro);
      const onConfirmClick = jest.fn();
      render(
        <FirmwareChangeLogView
          result={result}
          onConfirmClick={onConfirmClick}
        />,
      );

      tapUpdateNow();
      await dismissSuggestion(extra);

      expect(mockSetStepInfo).not.toHaveBeenCalled();
      expect(mockShowCheckList).not.toHaveBeenCalled();
      expect(onConfirmClick).not.toHaveBeenCalled();

      // The next tap starts over and can still go through.
      tapUpdateNow();
      expect(mockDialogShow).toHaveBeenCalledTimes(2);
      await continueViaBluetooth();

      expect(mockShowCheckList).toHaveBeenCalledTimes(1);
      expect(mockShowCheckList).toHaveBeenCalledWith({ result });
      expect(onConfirmClick).toHaveBeenCalledTimes(1);
    },
  );

  it('ignores further taps while the suggestion is open', async () => {
    const onConfirmClick = jest.fn();
    render(
      <FirmwareChangeLogView
        result={buildResult(EDeviceType.Pro2)}
        onConfirmClick={onConfirmClick}
      />,
    );

    tapUpdateNow();
    tapUpdateNow();
    tapUpdateNow();
    expect(mockDialogShow).toHaveBeenCalledTimes(1);

    await continueViaBluetooth();

    expect(mockShowCheckList).toHaveBeenCalledTimes(1);
    expect(onConfirmClick).toHaveBeenCalledTimes(1);
  });

  it('does not advance once the changelog has unmounted', async () => {
    const onConfirmClick = jest.fn();
    const { unmount } = render(
      <FirmwareChangeLogView
        result={buildResult(EDeviceType.Pro2)}
        onConfirmClick={onConfirmClick}
      />,
    );

    tapUpdateNow();
    unmount();
    await continueViaBluetooth();

    expect(mockSetStepInfo).not.toHaveBeenCalled();
    expect(mockShowCheckList).not.toHaveBeenCalled();
    expect(onConfirmClick).not.toHaveBeenCalled();
  });

  it('closes the open suggestion when the changelog unmounts', () => {
    const close = jest.fn();
    mockDialogShow.mockReturnValueOnce({
      close,
      getForm: () => undefined,
      isExist: () => true,
    });
    const { unmount } = render(
      <FirmwareChangeLogView result={buildResult(EDeviceType.Pro2)} />,
    );

    tapUpdateNow();
    expect(close).not.toHaveBeenCalled();
    unmount();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('leaves an already closed suggestion alone on unmount', async () => {
    const close = jest.fn();
    mockDialogShow.mockReturnValueOnce({
      close,
      getForm: () => undefined,
      isExist: () => true,
    });
    const { unmount } = render(
      <FirmwareChangeLogView result={buildResult(EDeviceType.Pro2)} />,
    );

    tapUpdateNow();
    await continueViaBluetooth();
    unmount();

    expect(close).not.toHaveBeenCalled();
  });

  it('does not ask again when the entry already showed the suggestion', () => {
    const result = buildResult(EDeviceType.Pro2);
    const onConfirmClick = jest.fn();
    render(
      <FirmwareChangeLogView
        result={result}
        onConfirmClick={onConfirmClick}
        usbSuggestionAcknowledged
      />,
    );

    tapUpdateNow();

    expect(mockDialogShow).not.toHaveBeenCalled();
    expect(mockShowCheckList).toHaveBeenCalledTimes(1);
    expect(mockShowCheckList).toHaveBeenCalledWith({ result });
    expect(onConfirmClick).toHaveBeenCalledTimes(1);
  });

  it.each([
    EDeviceType.Classic1s,
    EDeviceType.ClassicPure,
    EDeviceType.Touch,
    EDeviceType.Mini,
  ])('opens the checklist straight away for %s on mobile', (deviceType) => {
    const result = buildResult(deviceType);
    const onConfirmClick = jest.fn();
    render(
      <FirmwareChangeLogView result={result} onConfirmClick={onConfirmClick} />,
    );

    tapUpdateNow();

    expect(mockDialogShow).not.toHaveBeenCalled();
    expect(mockShowCheckList).toHaveBeenCalledTimes(1);
    expect(mockShowCheckList).toHaveBeenCalledWith({ result });
    expect(onConfirmClick).toHaveBeenCalledTimes(1);
  });

  it('retries without the suggestion', async () => {
    const onRetryClick = jest.fn(async () => {});
    render(
      <FirmwareChangeLogView
        result={buildResult(EDeviceType.Pro2)}
        onRetryClick={onRetryClick}
      />,
    );

    tapUpdateNow();
    await settleHandlers();

    expect(onRetryClick).toHaveBeenCalledTimes(1);
    expect(mockDialogShow).not.toHaveBeenCalled();
    expect(mockSetStepInfo).not.toHaveBeenCalled();
    expect(mockShowCheckList).not.toHaveBeenCalled();
  });

  describe('on desktop', () => {
    beforeEach(() => {
      mockIsNative = false;
      mockIsDesktop = true;
    });

    it('opens the checklist without the suggestion when USB is available', async () => {
      const result = buildResult(EDeviceType.Pro2);
      const onConfirmClick = jest.fn();
      render(
        <FirmwareChangeLogView
          result={result}
          onConfirmClick={onConfirmClick}
        />,
      );

      tapUpdateNow();
      await waitFor(() => {
        expect(mockShowCheckList).toHaveBeenCalledTimes(1);
      });

      expect(mockDialogShow).not.toHaveBeenCalled();
      expect(mockShowCheckList).toHaveBeenCalledWith({ result });
      expect(onConfirmClick).toHaveBeenCalledTimes(1);
    });

    it('keeps the USB-required dialog when no USB device is found', async () => {
      mockDetectUSBDeviceAvailability.mockResolvedValue(false);
      render(<FirmwareChangeLogView result={buildResult(EDeviceType.Pro2)} />);

      tapUpdateNow();
      await waitFor(() => {
        expect(mockDialogShow).toHaveBeenCalledTimes(1);
      });
      await settleHandlers();

      expect(lastDialogProps()).toMatchObject({
        title: ETranslations.upgrade_use_usb,
        description: ETranslations.upgrade_recommend_usb,
        onConfirmText: ETranslations.global_got_it,
        showCancelButton: false,
      });
      expect(mockDetectUSBDeviceAvailability).toHaveBeenCalledWith({
        connectId: 'usb-connect-id',
        connectProtocol: undefined,
      });
      expect(mockSetStepInfo).not.toHaveBeenCalled();
      expect(mockShowCheckList).not.toHaveBeenCalled();
    });
  });
});
