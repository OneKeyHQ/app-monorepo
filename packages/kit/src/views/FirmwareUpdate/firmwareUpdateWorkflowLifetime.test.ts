import {
  getFirmwareUpdateWorkflowAlivePageCountForTest,
  releaseFirmwareUpdateWorkflowPage,
  resetFirmwareUpdateWorkflowLifetimeForTest,
  retainFirmwareUpdateWorkflowPage,
} from './firmwareUpdateWorkflowLifetime';

describe('firmwareUpdateWorkflowLifetime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetFirmwareUpdateWorkflowLifetimeForTest();
  });

  afterEach(() => {
    resetFirmwareUpdateWorkflowLifetimeForTest();
    jest.useRealTimers();
  });

  it('does not exit when navigating from changelog to install', () => {
    const onReallyLeave = jest.fn();

    retainFirmwareUpdateWorkflowPage();
    retainFirmwareUpdateWorkflowPage();
    releaseFirmwareUpdateWorkflowPage(onReallyLeave);
    jest.advanceTimersByTime(1000);

    expect(onReallyLeave).not.toHaveBeenCalled();
    expect(getFirmwareUpdateWorkflowAlivePageCountForTest()).toBe(1);
  });

  it('does not exit when the install page remounts after a device reconnect', () => {
    const onReallyLeave = jest.fn();

    retainFirmwareUpdateWorkflowPage();
    releaseFirmwareUpdateWorkflowPage(onReallyLeave);
    retainFirmwareUpdateWorkflowPage();
    jest.advanceTimersByTime(1000);

    expect(onReallyLeave).not.toHaveBeenCalled();
    expect(getFirmwareUpdateWorkflowAlivePageCountForTest()).toBe(1);
  });

  it('exits only after the last firmware-update page stays gone', () => {
    const onReallyLeave = jest.fn();

    retainFirmwareUpdateWorkflowPage();
    releaseFirmwareUpdateWorkflowPage(onReallyLeave);
    jest.advanceTimersByTime(499);
    expect(onReallyLeave).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onReallyLeave).toHaveBeenCalledTimes(1);
  });

  it('keeps the install-page cancel when an error returns to changelog', () => {
    const changelogLeave = jest.fn();
    const installLeave = jest.fn();

    retainFirmwareUpdateWorkflowPage();
    retainFirmwareUpdateWorkflowPage();
    releaseFirmwareUpdateWorkflowPage(installLeave);
    jest.advanceTimersByTime(1000);

    expect(installLeave).not.toHaveBeenCalled();
    expect(getFirmwareUpdateWorkflowAlivePageCountForTest()).toBe(1);

    releaseFirmwareUpdateWorkflowPage(changelogLeave);
    jest.advanceTimersByTime(500);

    expect(installLeave).toHaveBeenCalledTimes(1);
    expect(changelogLeave).toHaveBeenCalledTimes(1);
  });
});
