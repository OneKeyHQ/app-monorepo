import type { ReactElement } from 'react';

import { Dialog } from '@onekeyhq/components';
import type { IOnDialogConfirm } from '@onekeyhq/components/src/composite/Dialog/type';

import { showSimilarAddressDialog } from './SimilarAddressDialog';

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: ({ id }: { id: string }) => id,
    },
  },
}));

jest.mock('./SignGuardIcon', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedDialogShow = Dialog.show as jest.MockedFunction<typeof Dialog.show>;

describe('showSimilarAddressDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves only after the dialog close teardown completes', async () => {
    const resultPromise = showSimilarAddressDialog({
      similarAddress: '0x1234567890',
      currentAddress: '0x1234567891',
    });
    const options = mockedDialogShow.mock.calls[0][0];
    const content = options.renderContent as ReactElement<{
      onConfirm: IOnDialogConfirm;
    }>;
    let finishClose: (() => void) | undefined;
    const close = jest.fn(
      (extra?: { flag?: string }) =>
        new Promise<void>((resolve) => {
          finishClose = () => {
            void options.onClose?.(extra);
            resolve();
          };
        }),
    );
    let hasResolved = false;
    void resultPromise.then(() => {
      hasResolved = true;
    });

    const confirmPromise = content.props.onConfirm({
      close,
      getForm: () => undefined,
      isExist: () => true,
      preventClose: jest.fn(),
    });
    await Promise.resolve();

    expect(close).toHaveBeenCalledWith({ flag: 'confirm' });
    expect(hasResolved).toBe(false);

    finishClose?.();
    await confirmPromise;

    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('rejects only after one cancel close teardown completes', async () => {
    const resultPromise = showSimilarAddressDialog({
      similarAddress: '0x1234567890',
      currentAddress: '0x1234567891',
    });
    const options = mockedDialogShow.mock.calls[0][0];
    let finishClose: (() => void) | undefined;
    const close = jest.fn(
      (extra?: { flag?: string }) =>
        new Promise<void>((resolve) => {
          finishClose = () => {
            void options.onClose?.(extra);
            resolve();
          };
        }),
    );
    let hasRejected = false;
    void resultPromise.catch(() => {
      hasRejected = true;
    });

    options.onCancel?.(close);
    await Promise.resolve();

    expect(close).toHaveBeenCalledTimes(1);
    expect(hasRejected).toBe(false);

    finishClose?.();

    await expect(resultPromise).rejects.toThrow('User canceled');
  });
});
