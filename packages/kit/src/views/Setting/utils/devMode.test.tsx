/** @jest-environment node */

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { isCorrectDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { handleOpenDevMode, showDevModePasswordDialog } from './devMode';
import {
  cacheDevOnlyPassword,
  clearCachedDevOnlyPassword,
} from './devOnlyPassword';

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    Form: 'DialogForm',
    FormField: 'DialogFormField',
    show: jest.fn(),
  },
  Input: 'Input',
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  isCorrectDevOnlyPassword: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: class OneKeyLocalError extends Error {},
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: false },
}));

jest.mock('@onekeyhq/shared/src/utils/devModeUtils', () => ({
  switchWebDappMode: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: { switchDevMode: jest.fn() },
    servicePassword: { promptPasswordVerify: jest.fn() },
  },
}));

jest.mock('../../../components/MultipleClickStack', () => ({
  MultipleClickStack: 'MultipleClickStack',
}));

jest.mock('../pages/Tab/DevSettingsSection/showDevOnlyPasswordDialog', () => ({
  showDevOnlyPasswordDialog: jest.fn(),
}));

jest.mock('./devOnlyPassword', () => ({
  cacheDevOnlyPassword: jest.fn(),
  clearCachedDevOnlyPassword: jest.fn(),
  getCachedDevOnlyPassword: jest.fn(() => undefined),
}));

const mockIsCorrectDevOnlyPassword = jest.mocked(isCorrectDevOnlyPassword);
const mockCacheDevOnlyPassword = jest.mocked(cacheDevOnlyPassword);
const mockClearCachedDevOnlyPassword = jest.mocked(clearCachedDevOnlyPassword);
const mockSwitchDevMode = jest.spyOn(
  backgroundApiProxy.serviceDevSetting,
  'switchDevMode',
);
const mockPromptPasswordVerify = jest.spyOn(
  backgroundApiProxy.servicePassword,
  'promptPasswordVerify',
);

const mockedDialogShow = Dialog.show as jest.MockedFunction<typeof Dialog.show>;

type IClose = (extra?: { flag?: string }) => Promise<void>;
type IForm = { getValues: (name?: string) => unknown };
type IDialogOptions = {
  onConfirm: (params: {
    getForm: () => IForm;
    close: IClose;
  }) => void | Promise<void>;
  onCancel: (close: IClose) => void | Promise<void>;
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function expectPromisePending(promise: Promise<unknown>) {
  let settled = false;
  void promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await Promise.resolve();
  expect(settled).toBe(false);
}

describe('showDevModePasswordDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsCorrectDevOnlyPassword.mockReturnValue(true);
  });

  it('waits for the native dialog close animation before resolving', async () => {
    const resultPromise = showDevModePasswordDialog();
    const options = mockedDialogShow.mock.calls[0]?.[0] as IDialogOptions;
    const closeDeferred = createDeferred<void>();
    const close = jest.fn<Promise<void>, Parameters<IClose>>(
      () => closeDeferred.promise,
    );

    const confirmCallbackPromise = options.onConfirm({
      close,
      getForm: () => ({ getValues: () => 'valid-password' }),
    });
    await expectPromisePending(resultPromise);
    expect(close).toHaveBeenCalledWith({ flag: 'confirm' });

    closeDeferred.resolve();
    await confirmCallbackPromise;
    await expect(resultPromise).resolves.toBe(true);
    expect(mockCacheDevOnlyPassword).toHaveBeenCalledWith('valid-password');
  });

  it('waits for close before rejecting when cancelled', async () => {
    const resultPromise = showDevModePasswordDialog();
    const options = mockedDialogShow.mock.calls[0]?.[0] as IDialogOptions;
    const closeDeferred = createDeferred<void>();
    const close = jest.fn<Promise<void>, Parameters<IClose>>(
      () => closeDeferred.promise,
    );

    const cancelCallbackPromise = options.onCancel(close);
    await expectPromisePending(resultPromise);
    expect(close).toHaveBeenCalledWith();

    closeDeferred.resolve();
    await expect(cancelCallbackPromise).resolves.toBeUndefined();
    await expect(resultPromise).rejects.toThrow('User canceled');
  });

  it('waits for close before rejecting an invalid password', async () => {
    mockIsCorrectDevOnlyPassword.mockReturnValue(false);
    const resultPromise = showDevModePasswordDialog();
    const options = mockedDialogShow.mock.calls[0]?.[0] as IDialogOptions;
    const closeDeferred = createDeferred<void>();
    const close = jest.fn<Promise<void>, Parameters<IClose>>(
      () => closeDeferred.promise,
    );

    const confirmCallbackPromise = options.onConfirm({
      close,
      getForm: () => ({ getValues: () => 'invalid-password' }),
    });
    await expectPromisePending(resultPromise);
    expect(close).toHaveBeenCalledWith();

    closeDeferred.resolve();
    await confirmCallbackPromise;
    await expect(resultPromise).rejects.toThrow('Invalid dev password');
    expect(mockClearCachedDevOnlyPassword).toHaveBeenCalledWith(
      'invalid-password',
    );
  });

  it('closes each dialog before mounting the next developer-mode prompt', async () => {
    const onCopyVersion = jest.fn();
    for (let clickIndex = 0; clickIndex < 9; clickIndex += 1) {
      await handleOpenDevMode(onCopyVersion);
    }

    const flowPromise = handleOpenDevMode(onCopyVersion);
    const passwordDialog = mockedDialogShow.mock
      .calls[0]?.[0] as IDialogOptions;
    const passwordCloseDeferred = createDeferred<void>();
    const passwordClose = jest.fn<Promise<void>, Parameters<IClose>>(
      () => passwordCloseDeferred.promise,
    );
    const passwordConfirmPromise = passwordDialog.onConfirm({
      close: passwordClose,
      getForm: () => ({ getValues: () => 'valid-password' }),
    });

    await expectPromisePending(flowPromise);
    expect(mockedDialogShow).toHaveBeenCalledTimes(1);

    passwordCloseDeferred.resolve();
    await passwordConfirmPromise;
    await Promise.resolve();
    expect(mockedDialogShow).toHaveBeenCalledTimes(2);

    const promoteDialog = mockedDialogShow.mock.calls[1]?.[0] as IDialogOptions;
    const promoteCloseDeferred = createDeferred<void>();
    const promoteClose = jest.fn<Promise<void>, Parameters<IClose>>(
      () => promoteCloseDeferred.promise,
    );
    const promoteConfirmPromise = promoteDialog.onConfirm({
      close: promoteClose,
      getForm: () => ({ getValues: () => undefined }),
    });

    await Promise.resolve();
    expect(mockPromptPasswordVerify).not.toHaveBeenCalled();

    promoteCloseDeferred.resolve();
    await promoteConfirmPromise;
    await flowPromise;
    expect(mockPromptPasswordVerify).toHaveBeenCalledTimes(1);
    expect(mockSwitchDevMode).toHaveBeenCalledWith(true);
  });
});
