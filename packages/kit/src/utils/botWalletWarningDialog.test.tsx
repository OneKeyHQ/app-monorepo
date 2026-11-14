import type {
  IDialogInstance,
  IDialogShowProps,
} from '@onekeyhq/components/src/composite/Dialog/type';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { showBotWalletDeactivatedWarningDialog } from './botWalletWarningDialog';

const mockShow = jest.fn<IDialogInstance, [IDialogShowProps]>();
const mockError = jest.fn<void, [unknown]>();

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (props: IDialogShowProps) => mockShow(props) },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { showToastOfError: (error: unknown) => mockError(error) },
}));

function openDialog(signal?: AbortSignal) {
  let props: IDialogShowProps | undefined;
  const instance = {
    close: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    getForm: () => undefined,
    isExist: () => true,
    preventClose: () => undefined,
  };
  mockShow.mockImplementation((value: IDialogShowProps) => {
    props = value;
    return instance;
  });
  const result = showBotWalletDeactivatedWarningDialog(signal);
  const getProps = () => {
    if (!props) throw new OneKeyLocalError('Dialog was not shown');
    return props;
  };
  return { result, instance, getProps };
}

describe('Bot wallet deactivation warning', () => {
  beforeEach(() => jest.resetAllMocks());

  it('preserves no-signal confirmation and closes the dialog', async () => {
    const dialog = openDialog();
    const confirm = dialog.getProps().onConfirm?.(dialog.instance);
    await expect(dialog.result).resolves.toBe(true);
    await confirm;
    expect(dialog.instance.close).toHaveBeenCalledTimes(1);
  });

  it('accepts confirmation with a signal even when close calls onClose', async () => {
    const controller = new AbortController();
    const dialog = openDialog(controller.signal);
    dialog.instance.close.mockImplementation(async () => {
      await dialog.getProps().onClose?.();
    });
    await dialog.getProps().onConfirm?.(dialog.instance);
    await expect(dialog.result).resolves.toBe(true);
  });

  it.each(['onCancel', 'onClose'] as const)(
    'returns false on %s',
    async (event) => {
      const dialog = openDialog();
      if (event === 'onCancel')
        dialog.getProps().onCancel?.(async () => undefined);
      else await dialog.getProps().onClose?.();
      await expect(dialog.result).resolves.toBe(false);
    },
  );

  it('does not show a dialog for an already aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      showBotWalletDeactivatedWarningDialog(controller.signal),
    ).resolves.toBe(false);
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('resolves false and closes the shown dialog on abort', async () => {
    const controller = new AbortController();
    const dialog = openDialog(controller.signal);
    controller.abort();
    await expect(dialog.result).resolves.toBe(false);
    await Promise.resolve();
    expect(dialog.instance.close).toHaveBeenCalledTimes(1);
    await dialog.getProps().onConfirm?.(dialog.instance);
    expect(dialog.instance.close).toHaveBeenCalledTimes(1);
  });

  it('closes the dialog when abort happens during creation', async () => {
    const controller = new AbortController();
    const instance = {
      close: jest.fn(async () => undefined),
      getForm: () => undefined,
      isExist: () => true,
    };
    mockShow.mockImplementation(() => {
      controller.abort();
      return instance;
    });
    await expect(
      showBotWalletDeactivatedWarningDialog(controller.signal),
    ).resolves.toBe(false);
    await Promise.resolve();
    expect(instance.close).toHaveBeenCalledTimes(1);
  });

  it('returns false when abort races with an in-flight confirmation close', async () => {
    const controller = new AbortController();
    const dialog = openDialog(controller.signal);
    let finishClose: () => void = () => undefined;
    dialog.instance.close.mockReturnValue(
      new Promise((resolve) => {
        finishClose = resolve;
      }),
    );
    const confirming = dialog.getProps().onConfirm?.(dialog.instance);
    controller.abort();
    await expect(dialog.result).resolves.toBe(false);
    finishClose();
    await confirming;
    expect(dialog.instance.close).toHaveBeenCalledTimes(1);
  });

  it('resolves false and reports confirmation-close failure', async () => {
    const controller = new AbortController();
    const dialog = openDialog(controller.signal);
    const error = new Error('close failed');
    dialog.instance.close.mockRejectedValue(error);
    await dialog.getProps().onConfirm?.(dialog.instance);
    await expect(dialog.result).resolves.toBe(false);
    expect(mockError).toHaveBeenCalledWith(error);
  });

  it('handles a failed abort-close without leaving the decision pending', async () => {
    const controller = new AbortController();
    const dialog = openDialog(controller.signal);
    const error = new Error('close failed');
    dialog.instance.close.mockRejectedValue(error);
    controller.abort();
    await expect(dialog.result).resolves.toBe(false);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockError).toHaveBeenCalledWith(error);
  });
});
