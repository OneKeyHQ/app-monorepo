import { EFirmwareUpdateSteps } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  getFirmwareUpdateWorkflowAlivePageCountForTest,
  releaseFirmwareUpdateWorkflowPage,
  resetFirmwareUpdateWorkflowLifetimeForTest,
  retainFirmwareUpdateWorkflowPage,
  shouldCancelDeviceWhenLeavingFirmwareUpdate,
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

  it('uses the latest step when an Extension cleanup callback runs', async () => {
    let currentStep = EFirmwareUpdateSteps.installing;
    const getCurrentStep = jest.fn(async () => currentStep);

    currentStep = EFirmwareUpdateSteps.updateDone;

    await expect(
      shouldCancelDeviceWhenLeavingFirmwareUpdate(true, getCurrentStep),
    ).resolves.toBe(false);
    expect(getCurrentStep).toHaveBeenCalledTimes(1);
  });

  it('keeps canceling an incomplete Extension firmware update', async () => {
    await expect(
      shouldCancelDeviceWhenLeavingFirmwareUpdate(
        true,
        async () => EFirmwareUpdateSteps.installing,
      ),
    ).resolves.toBe(true);
  });

  it('keeps canceling on non-Extension platforms without reading the step', async () => {
    const getCurrentStep = jest.fn(async () => EFirmwareUpdateSteps.updateDone);

    await expect(
      shouldCancelDeviceWhenLeavingFirmwareUpdate(false, getCurrentStep),
    ).resolves.toBe(true);
    expect(getCurrentStep).not.toHaveBeenCalled();
  });
});
