/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { act, render, renderHook, waitFor } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import useNFC from './useNFC';

type ITestDialog = {
  renderContent: ReactElement;
  onConfirm?: (params: { preventClose: () => void }) => void;
};

const mockClose = jest.fn(async () => undefined);
const mockShow = jest.fn((_options: ITestDialog) => ({ close: mockClose }));
const mockConfirm = jest.fn((_options: ITestDialog) => ({ close: mockClose }));
const mockAddConnectListener = jest.fn<
  void,
  [(event: { code: number }) => void]
>();
const mockRemoveConnectListeners = jest.fn<void, []>();
const mockPlatform = { isNativeAndroid: true };
const mockSearchingModule = jest.fn(() => ({ nm: 'searching' }));
const mockConnectingModule = jest.fn(() => ({ nm: 'connecting' }));
const mockLottie = jest.fn(
  ({ height }: { height: number; source: unknown }) => (
    <div data-testid="nfc-animation" data-height={height} />
  ),
);

jest.mock('@onekeyfe/react-native-lite-card', () => ({
  __esModule: true,
  default: {
    addConnectListener: (...args: [(event: { code: number }) => void]) =>
      mockAddConnectListener(...args),
    removeConnectListeners: () => mockRemoveConnectListeners(),
  },
  CardErrors: {},
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeAndroid() {
      return mockPlatform.isNativeAndroid;
    },
  },
}));
jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (options: ITestDialog) => mockShow(options),
    confirm: (options: ITestDialog) => mockConfirm(options),
  },
  LottieView: (props: { height: number; source: unknown }) => mockLottie(props),
  Stack: ({ height }: { height: number }) => (
    <div data-testid="nfc-animation-placeholder" data-height={height} />
  ),
}));
jest.mock(
  '@onekeyhq/kit/assets/animations/connect_onekeylite_searching.json',
  () => mockSearchingModule(),
);
jest.mock(
  '@onekeyhq/kit/assets/animations/connect_onekeylite_connecting.json',
  () => mockConnectingModule(),
);

describe('LiteCard NFC animation loading', () => {
  it('loads animations only for visible dialogs and keeps NFC running when loading fails', async () => {
    const { result, unmount } = renderHook(() => useNFC());
    expect(mockSearchingModule).not.toHaveBeenCalled();
    expect(mockConnectingModule).not.toHaveBeenCalled();
    const callback = jest.fn();
    await act(async () => result.current.createNFCConnection(callback)());
    expect(callback).toHaveBeenCalledTimes(1);
    expect(mockSearchingModule).not.toHaveBeenCalled();

    mockSearchingModule.mockImplementationOnce(() => {
      throw new OneKeyLocalError('Animation segment could not load');
    });
    const failedAnimation = render(mockShow.mock.calls[0][0].renderContent);
    await waitFor(() => expect(mockSearchingModule).toHaveBeenCalledTimes(1));
    expect(
      failedAnimation
        .getByTestId('nfc-animation-placeholder')
        .getAttribute('data-height'),
    ).toBe('205');
    expect(failedAnimation.queryByTestId('nfc-animation')).toBeNull();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(mockClose).not.toHaveBeenCalled();
    failedAnimation.unmount();

    await act(async () => result.current.createNFCConnection(callback)());
    const searchingAnimation = render(mockShow.mock.calls[1][0].renderContent);
    await waitFor(() =>
      expect(searchingAnimation.getByTestId('nfc-animation')).toBeTruthy(),
    );
    expect(mockLottie).toHaveBeenLastCalledWith({
      source: { nm: 'searching' },
      height: 205,
    });
    expect(mockConnectingModule).not.toHaveBeenCalled();

    act(() => mockAddConnectListener.mock.calls[0][0]({ code: 2 }));
    expect(mockClose).toHaveBeenCalledTimes(1);
    searchingAnimation.unmount();
    const connectingAnimation = render(mockShow.mock.calls[2][0].renderContent);
    await waitFor(() =>
      expect(connectingAnimation.getByTestId('nfc-animation')).toBeTruthy(),
    );
    expect(mockLottie).toHaveBeenLastCalledWith({
      source: { nm: 'connecting' },
      height: 225,
    });
    expect(callback).toHaveBeenCalledTimes(2);
    connectingAnimation.unmount();
    unmount();
    expect(mockRemoveConnectListeners).toHaveBeenCalledTimes(1);
  });

  it('still waits for confirmation before starting NFC on iOS', async () => {
    mockPlatform.isNativeAndroid = false;
    const { result } = renderHook(() => useNFC());
    const callback = jest.fn();
    await act(async () => result.current.createNFCConnection(callback)());
    expect(callback).not.toHaveBeenCalled();
    const dialog = mockConfirm.mock.calls[0][0];
    const animation = render(dialog.renderContent);
    await waitFor(() =>
      expect(animation.getByTestId('nfc-animation')).toBeTruthy(),
    );
    expect(mockLottie).toHaveBeenLastCalledWith({
      source: { nm: 'searching' },
      height: 205,
    });
    const preventClose = jest.fn();
    act(() => dialog.onConfirm?.({ preventClose }));
    expect(preventClose).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
