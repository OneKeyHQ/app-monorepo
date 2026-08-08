import {
  ECheckAndUpdateStepId,
  ECheckAndUpdateStepState,
  beginPostUpdateRecheck,
  isCheckAndUpdateReady,
  isCheckAndUpdateRetryDisabled,
  keepPostUpdateGenuineRecheckArmed,
} from './checkAndUpdateStepState';

describe('checkAndUpdateStepState', () => {
  it('retires a stale genuine-check error when post-update recheck starts', () => {
    const steps = beginPostUpdateRecheck([
      {
        id: ECheckAndUpdateStepId.GenuineCheck,
        state: ECheckAndUpdateStepState.Error,
        errorMessage: 'Device is in bootloader mode',
      },
      {
        id: ECheckAndUpdateStepId.FirmwareCheck,
        state: ECheckAndUpdateStepState.Warning,
        errorMessage: 'Previous firmware check failed',
      },
    ]);

    expect(steps).toEqual([
      {
        id: ECheckAndUpdateStepId.GenuineCheck,
        state: ECheckAndUpdateStepState.Idle,
        errorMessage: undefined,
      },
      {
        id: ECheckAndUpdateStepId.FirmwareCheck,
        state: ECheckAndUpdateStepState.InProgress,
        errorMessage: undefined,
      },
    ]);
    expect(isCheckAndUpdateRetryDisabled(steps)).toBe(true);
    expect(isCheckAndUpdateReady(steps)).toBe(false);
  });

  it('preserves a completed genuine check during post-update recheck', () => {
    const steps = beginPostUpdateRecheck([
      {
        id: ECheckAndUpdateStepId.GenuineCheck,
        state: ECheckAndUpdateStepState.Success,
      },
      {
        id: ECheckAndUpdateStepId.FirmwareCheck,
        state: ECheckAndUpdateStepState.Warning,
      },
    ]);

    expect(steps[0].state).toBe(ECheckAndUpdateStepState.Success);
    expect(steps[1].state).toBe(ECheckAndUpdateStepState.InProgress);
  });

  it('keeps a pending genuine recheck armed across a second firmware update', () => {
    const armedAfterFirstUpdate = keepPostUpdateGenuineRecheckArmed(
      false,
      ECheckAndUpdateStepState.Error,
    );

    expect(
      keepPostUpdateGenuineRecheckArmed(
        armedAfterFirstUpdate,
        ECheckAndUpdateStepState.Idle,
      ),
    ).toBe(true);
  });

  it('does not allow continuation until both checks are accepted', () => {
    expect(
      isCheckAndUpdateReady([
        {
          id: ECheckAndUpdateStepId.GenuineCheck,
          state: ECheckAndUpdateStepState.Idle,
        },
        {
          id: ECheckAndUpdateStepId.FirmwareCheck,
          state: ECheckAndUpdateStepState.Success,
        },
      ]),
    ).toBe(false);

    expect(
      isCheckAndUpdateReady([
        {
          id: ECheckAndUpdateStepId.GenuineCheck,
          state: ECheckAndUpdateStepState.Success,
        },
        {
          id: ECheckAndUpdateStepId.FirmwareCheck,
          state: ECheckAndUpdateStepState.Success,
        },
      ]),
    ).toBe(true);
  });

  it('enables retry only after the active recheck reaches an error', () => {
    const inProgressSteps = [
      {
        id: ECheckAndUpdateStepId.GenuineCheck,
        state: ECheckAndUpdateStepState.Idle,
      },
      {
        id: ECheckAndUpdateStepId.FirmwareCheck,
        state: ECheckAndUpdateStepState.InProgress,
      },
    ];
    const failedSteps = [
      inProgressSteps[0],
      {
        id: ECheckAndUpdateStepId.FirmwareCheck,
        state: ECheckAndUpdateStepState.Error,
      },
    ];

    expect(isCheckAndUpdateRetryDisabled(inProgressSteps)).toBe(true);
    expect(isCheckAndUpdateRetryDisabled(failedSteps)).toBe(false);
  });
});
