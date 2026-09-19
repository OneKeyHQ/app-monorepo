import { createIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';

import { confirmPrimeTransferImportExit } from './confirmPrimeTransferImportExit';

let mockIsImporting = false;
let mockTaskUUID = 'task-1';
let mockDialog: IDialogShowProps | undefined;
const mockShow = jest.fn((props: IDialogShowProps) => {
  mockDialog = props;
});
jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (props: IDialogShowProps) => mockShow(props) },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  primeTransferAtom: {
    get: async () => ({
      importProgress: { isImporting: mockIsImporting, taskUUID: mockTaskUUID },
    }),
  },
}));
const intl = createIntl({ locale: 'en-US', onError: () => undefined });

describe('Prime Transfer import exit confirmation', () => {
  beforeEach(() => {
    mockIsImporting = false;
    mockTaskUUID = 'task-1';
    mockDialog = undefined;
    mockShow.mockClear();
  });

  test('completed or failed imports close without confirmation', async () => {
    await expect(confirmPrimeTransferImportExit(intl)).resolves.toBe(true);
    expect(mockShow).not.toHaveBeenCalled();
  });

  test('repeated exits share one confirmation and cancel leaves the import active', async () => {
    mockIsImporting = true;
    const first = confirmPrimeTransferImportExit(intl);
    const second = confirmPrimeTransferImportExit(intl);
    await Promise.resolve();
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockDialog?.disableDrag).toBe(true);
    expect(mockDialog?.dismissOnOverlayPress).toBe(false);
    await mockDialog?.onClose?.();
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
    expect(mockIsImporting).toBe(true);
  });

  test('confirmation allows close and a later dismissal cannot reverse it', async () => {
    mockIsImporting = true;
    const confirmed = confirmPrimeTransferImportExit(intl);
    await Promise.resolve();
    // Dialog.Footer supplies these callbacks when the user confirms.
    await mockDialog?.onConfirm?.({
      preventClose: () => undefined,
      close: () => undefined,
      getForm: () => undefined,
      isExist: () => true,
    });
    await mockDialog?.onClose?.();
    await expect(confirmed).resolves.toBe(true);
  });
  test('an error during exit confirmation allows cleanup even if the user chooses cancel', async () => {
    mockIsImporting = true;
    const closing = confirmPrimeTransferImportExit(intl, 'task-1');
    await Promise.resolve();
    mockIsImporting = false;
    await mockDialog?.onClose?.();
    await expect(closing).resolves.toBe(true);
  });

  test('an old dialog can close without prompting or cancelling the replacement task', async () => {
    mockIsImporting = true;
    const closing = confirmPrimeTransferImportExit(intl, 'task-1');
    await Promise.resolve();
    mockTaskUUID = 'task-2';
    await mockDialog?.onClose?.();
    await expect(closing).resolves.toBe(true);
    await expect(confirmPrimeTransferImportExit(intl, 'task-1')).resolves.toBe(
      true,
    );
    expect(mockShow).toHaveBeenCalledTimes(1);
  });
});
