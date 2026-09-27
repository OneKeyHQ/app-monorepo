import { createIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';

import { confirmPrimeTransferImportExit } from './confirmPrimeTransferImportExit';

let mockIsImporting = false;
let mockTaskUUID = 'task-1';
let mockHasProgress = true;
let mockDialog: IDialogShowProps | undefined;
const mockListeners = new Set<() => void>();
const mockClose = jest.fn();
const mockShow = jest.fn((props: IDialogShowProps) => {
  mockDialog = props;
  return {
    close: async () => {
      mockClose();
      await props.onClose?.();
    },
  };
});
jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (props: IDialogShowProps) => mockShow(props) },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  primeTransferAtom: {
    get: async () => ({
      importProgress: mockHasProgress
        ? { isImporting: mockIsImporting, taskUUID: mockTaskUUID }
        : undefined,
    }),
    sub: (listener: () => void) => {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    },
  },
}));
const intl = createIntl({ locale: 'en-US', onError: () => undefined });

function notifyProgressChanged() {
  mockListeners.forEach((listener) => listener());
}

describe('Prime Transfer import exit confirmation', () => {
  beforeEach(() => {
    mockIsImporting = false;
    mockTaskUUID = 'task-1';
    mockHasProgress = true;
    mockDialog = undefined;
    mockShow.mockClear();
    mockClose.mockClear();
  });

  test('completed or failed imports close without confirmation', async () => {
    await expect(confirmPrimeTransferImportExit(intl)).resolves.toBe(true);
    expect(mockShow).not.toHaveBeenCalled();
    expect(mockListeners.size).toBe(0);
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
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockListeners.size).toBe(0);
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
    expect(mockListeners.size).toBe(0);
  });
  test('an error during exit confirmation allows cleanup even if the user chooses cancel', async () => {
    mockIsImporting = true;
    const closing = confirmPrimeTransferImportExit(intl, 'task-1');
    await Promise.resolve();
    mockIsImporting = false;
    await mockDialog?.onClose?.();
    await expect(closing).resolves.toBe(true);
    expect(mockListeners.size).toBe(0);
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
    expect(mockListeners.size).toBe(0);
  });

  test.each(['finished', 'cleared'])(
    'an import that is %s dismisses its pending confirmation without user input',
    async (state) => {
      mockIsImporting = true;
      const first = confirmPrimeTransferImportExit(intl, 'task-1');
      const second = confirmPrimeTransferImportExit(intl, 'task-1');
      await Promise.resolve();
      expect(mockShow).toHaveBeenCalledTimes(1);
      notifyProgressChanged();
      await Promise.resolve();
      expect(mockClose).not.toHaveBeenCalled();

      if (state === 'cleared') mockHasProgress = false;
      else mockIsImporting = false;
      notifyProgressChanged();
      notifyProgressChanged();
      await Promise.resolve();
      expect(mockClose).toHaveBeenCalledTimes(1);
      await expect(first).resolves.toBe(true);
      await expect(second).resolves.toBe(true);
      expect(mockListeners.size).toBe(0);
    },
  );

  test('completion between the initial read and subscription does not leave a stale dialog', async () => {
    mockIsImporting = true;
    const closing = confirmPrimeTransferImportExit(intl, 'task-1');
    mockIsImporting = false;
    notifyProgressChanged();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockClose).toHaveBeenCalledTimes(1);
    await expect(closing).resolves.toBe(true);
    expect(mockListeners.size).toBe(0);
  });

  test('replacing a task dismisses only the old confirmation and preserves the new one', async () => {
    mockIsImporting = true;
    const oldClosing = confirmPrimeTransferImportExit(intl, 'task-1');
    await Promise.resolve();
    mockTaskUUID = 'task-2';
    notifyProgressChanged();
    const newClosing = confirmPrimeTransferImportExit(intl, 'task-2');
    await Promise.resolve();
    expect(mockClose).toHaveBeenCalledTimes(1);
    await expect(oldClosing).resolves.toBe(true);
    expect(mockShow).toHaveBeenCalledTimes(2);
    expect(mockListeners.size).toBe(1);
    await mockDialog?.onClose?.();
    await expect(newClosing).resolves.toBe(false);
    expect(mockIsImporting).toBe(true);
    expect(mockListeners.size).toBe(0);
  });
});
