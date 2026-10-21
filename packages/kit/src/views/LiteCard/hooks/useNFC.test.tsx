/** @jest-environment jsdom */

import { isValidElement } from 'react';

import { renderHook } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useNFC from './useNFC';

jest.mock('@onekeyfe/react-native-lite-card', () => ({
  __esModule: true,
  default: {
    addConnectListener: jest.fn(),
    removeConnectListeners: jest.fn(),
  },
  CardErrors: {},
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn(), confirm: jest.fn() },
  LottieView: () => null,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeAndroid: true },
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({ ETranslations: {} }));

describe('Lite card search animation loading', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the animation before showing the Android dialog and starting NFC', async () => {
    platformEnv.isNativeAndroid = true;
    const { result } = renderHook(() => useNFC());
    const connect = jest.fn();
    expect(Dialog.show).not.toHaveBeenCalled();

    await result.current.createNFCConnection(connect)();

    const dialog = jest.mocked(Dialog.show).mock.calls[0][0];
    const content = dialog.renderContent;
    expect(
      isValidElement<{ source: unknown }>(content)
        ? content.props.source
        : undefined,
    ).toMatchObject({
      layers: expect.any(Array),
    });
    expect(Dialog.show).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(jest.mocked(Dialog.show).mock.invocationCallOrder[0]).toBeLessThan(
      connect.mock.invocationCallOrder[0],
    );
  });

  it('loads the animation but waits for confirmation before starting NFC on iOS', async () => {
    platformEnv.isNativeAndroid = false;
    const { result } = renderHook(() => useNFC());
    const connect = jest.fn();

    await result.current.createNFCConnection(connect)();

    const dialog = jest.mocked(Dialog.confirm).mock.calls[0][0];
    const content = dialog.renderContent;
    expect(
      isValidElement<{ source: unknown }>(content)
        ? content.props.source
        : undefined,
    ).toMatchObject({
      layers: expect.any(Array),
    });
    expect(connect).not.toHaveBeenCalled();
    const preventClose = jest.fn();
    await dialog.onConfirm?.({
      preventClose,
      close: jest.fn(),
      getForm: jest.fn(),
      isExist: () => true,
    });
    expect(preventClose).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
