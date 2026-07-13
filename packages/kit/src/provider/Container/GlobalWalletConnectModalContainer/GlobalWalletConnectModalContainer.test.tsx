/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { GlobalWalletConnectModalContainer } from './GlobalWalletConnectModalContainer';

let mockIsPageFocused = true;

jest.mock('@onekeyhq/components', () => ({
  Page: {
    Every: ({ children }: { children: React.ReactNode }) =>
      mockIsPageFocused ? children : null,
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeIOS: true,
  },
}));

jest.mock(
  '../../../components/WalletConnect/WalletConnectModalContainer',
  () => ({
    WalletConnectModalContainer: () => null,
  }),
);

async function flushLazyContainer() {
  await act(async () => Promise.resolve());
  act(() => {
    jest.runOnlyPendingTimers();
  });
  await act(async () => Promise.resolve());
}

describe('GlobalWalletConnectModalContainer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIsPageFocused = true;
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('replays the first event once and does not replay it after a page switch', async () => {
    const emitSpy = jest.spyOn(appEventBus, 'emit');
    const onOpen = jest.fn();
    appEventBus.on(EAppEventBusNames.WalletConnectOpenModal, onOpen);
    const view = render(<GlobalWalletConnectModalContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:first',
      });
    });
    await flushLazyContainer();

    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenCalledTimes(1);

    mockIsPageFocused = false;
    view.rerender(<GlobalWalletConnectModalContainer />);
    mockIsPageFocused = true;
    view.rerender(<GlobalWalletConnectModalContainer />);
    await flushLazyContainer();

    expect(onOpen).toHaveBeenCalledTimes(2);

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:second',
      });
    });
    await flushLazyContainer();

    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(emitSpy).toHaveBeenCalledTimes(2);
    appEventBus.off(EAppEventBusNames.WalletConnectOpenModal, onOpen);
  });

  it('drops a buffered open event when close arrives before lazy loading', async () => {
    const onOpen = jest.fn();
    appEventBus.on(EAppEventBusNames.WalletConnectOpenModal, onOpen);
    render(<GlobalWalletConnectModalContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectOpenModal, {
        uri: 'wc:cancelled',
      });
      appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, undefined);
    });
    await flushLazyContainer();

    expect(onOpen).toHaveBeenCalledTimes(1);
    appEventBus.off(EAppEventBusNames.WalletConnectOpenModal, onOpen);
  });
});
