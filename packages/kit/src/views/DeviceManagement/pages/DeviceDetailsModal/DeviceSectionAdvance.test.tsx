/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { DeviceManagementTestIDs } from '../../testIDs';

import DeviceSectionAdvance from './DeviceSectionAdvance';

type IPassphraseDialog = {
  needEnterPassphrase: boolean;
  onConfirmOpenPassphrase: () => Promise<void>;
  onCancelOpenPassphrase: () => Promise<void>;
};

const mockUpdatePassphraseEnabled = jest.fn<Promise<void>, [boolean]>();
const mockDialogShow = jest.fn<void, [IPassphraseDialog]>();
let mockActionResult: Promise<void> | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Switch: ({
    value,
    onChange,
    disabled,
    testID,
  }: {
    value: boolean;
    onChange: (value: boolean) => Promise<void>;
    disabled: boolean;
    testID: string;
  }) => (
    <button
      type="button"
      data-testid={testID}
      aria-pressed={value}
      disabled={disabled}
      onClick={() => {
        mockActionResult = onChange(!value);
        void mockActionResult.catch(() => {});
      }}
    >
      Passphrase
    </button>
  ),
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const { useStatefulAction } = jest.requireActual<
    typeof import('@onekeyhq/kit/src/hooks/useStatefulAction')
  >('@onekeyhq/kit/src/hooks/useStatefulAction');

  return {
    ListItem: {
      StatefulItem: ({
        value,
        onAction,
        children,
      }: {
        value: boolean;
        onAction: (value: boolean) => Promise<void>;
        children: (props: {
          value: boolean;
          disabled: boolean;
          onChange: (value: boolean) => Promise<void>;
        }) => ReactNode;
      }) => {
        const state = useStatefulAction({ value, onAction });
        return children(state);
      },
    },
  };
});
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/deviceDetails', () => ({
  useDeviceDetailsActions: () => ({
    updatePassphraseEnabled: mockUpdatePassphraseEnabled,
  }),
  useDevicePassphraseEnabledAtom: () => [false],
  useDevicePinOnAppEnabledAtom: () => [false],
  useDeviceTypeAtom: () => [undefined],
}));
jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: { checkInputPinOnSoftwareSupport: () => false },
}));
jest.mock('../ListItemGroup', () => ({
  ListItemGroup: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('./dialog/DialogPassphraseEnable', () => ({
  useDialogPassphraseEnable: () => ({ show: mockDialogShow }),
}));

describe('device passphrase switch', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockActionResult = undefined;
    mockUpdatePassphraseEnabled.mockResolvedValue(undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  function openDialog() {
    const view = render(<DeviceSectionAdvance />);
    const passphraseSwitch = view.getByTestId(
      DeviceManagementTestIDs.passphraseSwitch,
    );
    fireEvent.click(passphraseSwitch);
    expect(mockDialogShow).toHaveBeenCalledWith(
      expect.objectContaining({ needEnterPassphrase: true }),
    );
    return passphraseSwitch;
  }

  it('rejects cancellation as a local error and rolls back without updating the device', async () => {
    const passphraseSwitch = openDialog();
    expect(passphraseSwitch.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      await mockDialogShow.mock.calls[0][0].onCancelOpenPassphrase();
      await expect(mockActionResult).rejects.toBeInstanceOf(OneKeyLocalError);
    });

    expect(passphraseSwitch.getAttribute('aria-pressed')).toBe('false');
    expect(mockUpdatePassphraseEnabled).not.toHaveBeenCalled();
  });

  it('updates the device after confirmation', async () => {
    const passphraseSwitch = openDialog();

    await act(async () => {
      await mockDialogShow.mock.calls[0][0].onConfirmOpenPassphrase();
      await expect(mockActionResult).resolves.toBeUndefined();
    });

    expect(mockUpdatePassphraseEnabled).toHaveBeenCalledWith(true);
    expect(passphraseSwitch.getAttribute('aria-pressed')).toBe('true');
  });

  it('preserves a real update error and rolls back', async () => {
    const failure = new Error('Device update failed');
    mockUpdatePassphraseEnabled.mockRejectedValueOnce(failure);
    const passphraseSwitch = openDialog();

    await act(async () => {
      await mockDialogShow.mock.calls[0][0].onConfirmOpenPassphrase();
      await expect(mockActionResult).rejects.toBe(failure);
    });

    expect(mockUpdatePassphraseEnabled).toHaveBeenCalledWith(true);
    expect(passphraseSwitch.getAttribute('aria-pressed')).toBe('false');
  });
});
