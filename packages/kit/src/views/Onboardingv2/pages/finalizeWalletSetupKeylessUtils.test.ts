import {
  closePageAndOpenKeylessAutoConnect,
  openKeylessAutoConnectAfterDelay,
  scheduleFinalizeCloseAndKeylessAutoConnect,
} from './finalizeWalletSetupKeylessUtils';

describe('finalizeWalletSetupKeylessUtils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('opens the keyless auto-connect modal after the delay', () => {
    const openKeylessAutoConnectDappModal = jest.fn();

    openKeylessAutoConnectAfterDelay({
      openKeylessAutoConnectDappModal,
      modalDelayMs: 600,
    });

    jest.advanceTimersByTime(599);
    expect(openKeylessAutoConnectDappModal).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(openKeylessAutoConnectDappModal).toHaveBeenCalledTimes(1);
  });

  test('closes the page immediately before scheduling auto-connect', () => {
    const closePage = jest.fn();
    const openKeylessAutoConnectDappModal = jest.fn();

    closePageAndOpenKeylessAutoConnect({
      closePage,
      openKeylessAutoConnectDappModal,
      modalDelayMs: 600,
    });

    expect(closePage).toHaveBeenCalledTimes(1);
    expect(openKeylessAutoConnectDappModal).not.toHaveBeenCalled();

    jest.advanceTimersByTime(600);
    expect(openKeylessAutoConnectDappModal).toHaveBeenCalledTimes(1);
  });

  test('keeps the original delayed close behavior for the ready path', () => {
    const closePage = jest.fn();
    const openKeylessAutoConnectDappModal = jest.fn();

    scheduleFinalizeCloseAndKeylessAutoConnect({
      closePage,
      openKeylessAutoConnectDappModal,
      closeDelayMs: 1000,
      modalDelayMs: 600,
    });

    jest.advanceTimersByTime(999);
    expect(closePage).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(closePage).toHaveBeenCalledTimes(1);
    expect(openKeylessAutoConnectDappModal).not.toHaveBeenCalled();

    jest.advanceTimersByTime(600);
    expect(openKeylessAutoConnectDappModal).toHaveBeenCalledTimes(1);
  });
});
