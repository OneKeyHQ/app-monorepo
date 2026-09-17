import { createIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';

import { confirmPrimeTransferImportExit } from './confirmPrimeTransferImportExit';

let mockIsImporting = false;
let mockDialog: IDialogShowProps | undefined;
const mockShow = jest.fn((props: IDialogShowProps) => {
  mockDialog = props;
});
jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (props: IDialogShowProps) => mockShow(props) },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  primeTransferAtom: {
    get: async () => ({ importProgress: { isImporting: mockIsImporting } }),
  },
}));
const intl = createIntl({ locale: 'en-US', onError: () => undefined });

describe('Prime Transfer import exit confirmation', () => {
  beforeEach(() => {
    mockIsImporting = false;
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
});
