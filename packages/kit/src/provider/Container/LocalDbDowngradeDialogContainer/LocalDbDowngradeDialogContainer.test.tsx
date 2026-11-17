/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import { DialogContainer } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  LocalDbDowngradeDialogContainer,
  createLocalDbDowngradeDialogAcknowledgement,
} from './LocalDbDowngradeDialogContainer';

const DESKTOP_DOWNGRADE_ERROR =
  'The requested version (19) is less than the existing version (20).';
const NATIVE_DOWNGRADE_ERROR =
  'Provided schema version 19 is less than last set version 20.';

let mockIsLocked = false;
let mockErrorMessage: string | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  DialogContainer: jest.fn(() => null),
  Portal: {
    Body: ({ children }: { children: unknown }) => children,
    Constant: {
      FULL_WINDOW_OVERLAY_PORTAL: 'FULL_WINDOW_OVERLAY_PORTAL',
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/localDb', () => ({
  useLocalDbOpenErrorAtom: () => [{ errorMessage: mockErrorMessage }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [mockIsLocked],
}));

const mockedDialogContainer = DialogContainer as unknown as jest.Mock;

describe('createLocalDbDowngradeDialogAcknowledgement', () => {
  it.each([DESKTOP_DOWNGRADE_ERROR, NATIVE_DOWNGRADE_ERROR])(
    'keeps a confirmed downgrade visible until it is acknowledged: %s',
    (errorMessage) => {
      const acknowledgement = createLocalDbDowngradeDialogAcknowledgement();

      expect(
        acknowledgement.shouldShow({ errorMessage, isLocked: false }),
      ).toBe(true);
      expect(
        acknowledgement.shouldShow({ errorMessage, isLocked: false }),
      ).toBe(true);
      acknowledgement.acknowledge();
      expect(
        acknowledgement.shouldShow({ errorMessage, isLocked: false }),
      ).toBe(false);
    },
  );

  it('does not consume the one-time dialog while the app is locked', () => {
    const acknowledgement = createLocalDbDowngradeDialogAcknowledgement();

    expect(
      acknowledgement.shouldShow({
        errorMessage: DESKTOP_DOWNGRADE_ERROR,
        isLocked: true,
      }),
    ).toBe(false);
    expect(
      acknowledgement.shouldShow({
        errorMessage: DESKTOP_DOWNGRADE_ERROR,
        isLocked: false,
      }),
    ).toBe(true);
  });

  it.each([
    undefined,
    'DB open unknown error',
    'The requested version (20) is less than the existing version (20).',
    'The requested version (20) is less than the existing version (19).',
    'Provided schema version 20 is less than last set version 20.',
    'Provided schema version 20 is less than last set version 19.',
    `Error: ${DESKTOP_DOWNGRADE_ERROR}`,
    `${DESKTOP_DOWNGRADE_ERROR}
Another error`,
    ` ${NATIVE_DOWNGRADE_ERROR}`,
  ])('rejects every unconfirmed downgrade message: %s', (errorMessage) => {
    const acknowledgement = createLocalDbDowngradeDialogAcknowledgement();

    expect(acknowledgement.shouldShow({ errorMessage, isLocked: false })).toBe(
      false,
    );
  });
});

describe('LocalDbDowngradeDialogContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLocked = false;
    mockErrorMessage = undefined;
  });

  it('restores the warning until acknowledgement and suppresses it afterwards', () => {
    const view = render(<LocalDbDowngradeDialogContainer />);

    mockErrorMessage = 'DB open unknown error';
    view.rerender(<LocalDbDowngradeDialogContainer />);
    expect(mockedDialogContainer).not.toHaveBeenCalled();

    mockErrorMessage = DESKTOP_DOWNGRADE_ERROR;
    mockIsLocked = true;
    view.rerender(<LocalDbDowngradeDialogContainer />);
    expect(mockedDialogContainer).not.toHaveBeenCalled();

    mockIsLocked = false;
    view.rerender(<LocalDbDowngradeDialogContainer />);

    expect(mockedDialogContainer).toHaveBeenCalledTimes(1);
    expect(mockedDialogContainer.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        open: true,
        testID: 'local-db-downgrade-dialog',
        title: ETranslations.database_read_error_update_app__msg,
        description: DESKTOP_DOWNGRADE_ERROR,
        onConfirmText: ETranslations.global_got_it,
        showFooter: true,
        showConfirmButton: true,
        showExitButton: false,
        showCancelButton: false,
        dismissOnOverlayPress: false,
        disableDrag: true,
        disableSystemClose: true,
      }),
    );

    view.unmount();
    mockedDialogContainer.mockClear();
    const remountedView = render(<LocalDbDowngradeDialogContainer />);
    expect(mockedDialogContainer).toHaveBeenCalledTimes(1);

    const onConfirm = mockedDialogContainer.mock.calls[0][0].onConfirm as
      | (() => void)
      | undefined;
    act(() => {
      onConfirm?.();
    });

    remountedView.unmount();
    mockedDialogContainer.mockClear();
    render(<LocalDbDowngradeDialogContainer />);
    expect(mockedDialogContainer).not.toHaveBeenCalled();
  });
});
