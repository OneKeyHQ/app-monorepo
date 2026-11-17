/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';

import { DeviceManagementTestIDs } from '../../testIDs';

import DeviceSectionDangerZone from './DeviceSectionDangerZone';

let mockDevEnabled = true;
const mockReset = jest.fn<Promise<void>, [{ serialNo: string }]>();
const mockRefresh = jest.fn<Promise<void>, [{ serialNo: string }]>();
const mockDialogShow = jest.fn<void, [{ onConfirm: () => Promise<void> }]>();

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (options: { onConfirm: () => Promise<void> }) =>
      mockDialogShow(options),
  },
  Toast: { success: jest.fn(), error: jest.fn() },
  Spinner: () => null,
  XStack: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  servicePrime: {
    apiResetPrimeGift: (params: { serialNo: string }) => mockReset(params),
    apiGetPrimeGiftEligibility: (params: { serialNo: string }) =>
      mockRefresh(params),
  },
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    onPress,
    testID,
    disabled,
  }: {
    onPress?: () => void;
    testID?: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      disabled={disabled}
    >
      Action
    </button>
  ),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/deviceDetails', () => ({
  useDeviceAtom: () => [
    {
      uuid: 'FALLBACK_SERIAL',
      deviceStateInfo: { identity: { serialNo: 'CURRENT_SERIAL' } },
    },
  ],
  useDeviceDetailsActions: () => ({}),
  useDeviceMetaStaticAtom: () => [{}],
  useDeviceTypeAtom: () => ['pro'],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: mockDevEnabled }],
}));
jest.mock('../../../FirmwareUpdate/utils', () => ({
  getTargetFirmwareTypeLabel: jest.fn(),
}));
jest.mock('../ListItemGroup', () => ({
  ListItemGroup: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('./dialog/DialogFirmwareChange', () => ({
  useFirmwareChangeDialog: () => ({ show: jest.fn() }),
}));
jest.mock('./utils', () => ({
  getFirmwareTypeChangeAvailability: () => 'hidden',
}));

describe('Prime gift reset confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevEnabled = true;
    mockReset.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(undefined);
  });

  function openResetConfirmation() {
    const view = render(
      <DeviceSectionDangerZone onPressCheckForUpdates={jest.fn()} />,
    );
    fireEvent.click(
      view.getByTestId(DeviceManagementTestIDs.resetPrimeGiftItem),
    );
    return view;
  }

  it('hides the reset action outside developer mode', () => {
    mockDevEnabled = false;
    const { queryByTestId } = render(
      <DeviceSectionDangerZone onPressCheckForUpdates={jest.fn()} />,
    );
    expect(
      queryByTestId(DeviceManagementTestIDs.resetPrimeGiftItem),
    ).toBeNull();
  });

  it('does not reset or refresh when opening or dismissing the confirmation', () => {
    const { unmount } = openResetConfirmation();
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockReset).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('resets only the displayed device after confirmation, then refreshes its eligibility', async () => {
    openResetConfirmation();
    await act(async () => {
      await mockDialogShow.mock.calls[0][0].onConfirm();
    });
    expect(mockReset).toHaveBeenCalledWith({ serialNo: 'CURRENT_SERIAL' });
    expect(mockRefresh).toHaveBeenCalledWith({ serialNo: 'CURRENT_SERIAL' });
    expect(mockReset.mock.invocationCallOrder[0]).toBeLessThan(
      mockRefresh.mock.invocationCallOrder[0],
    );
    expect(Toast.success).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing eligibility when the server rejects a reset', async () => {
    mockReset.mockRejectedValueOnce(new Error('Reset rejected'));
    openResetConfirmation();
    await act(async () => {
      await mockDialogShow.mock.calls[0][0].onConfirm();
    });
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(Toast.success).not.toHaveBeenCalled();
    expect(Toast.error).toHaveBeenCalledWith({ title: 'Reset rejected' });
  });
});
