export enum ECheckAndUpdateStepState {
  Idle = 'idle',
  InProgress = 'inProgress',
  Warning = 'warning',
  Skipped = 'skipped',
  Success = 'success',
  Error = 'error',
}

export enum ECheckAndUpdateStepId {
  GenuineCheck = 'genuine-check',
  FirmwareCheck = 'firmware-check',
}

export type ICheckAndUpdateStep = {
  id: ECheckAndUpdateStepId;
  state?: ECheckAndUpdateStepState;
  errorMessage?: string;
};

export function isCheckAndUpdateStepAccepted(
  state: ECheckAndUpdateStepState | undefined,
) {
  return (
    state === ECheckAndUpdateStepState.Success ||
    state === ECheckAndUpdateStepState.Skipped
  );
}

export function isCheckAndUpdateReady(steps: ICheckAndUpdateStep[]) {
  const genuineStep = steps.find(
    (step) => step.id === ECheckAndUpdateStepId.GenuineCheck,
  );
  const firmwareStep = steps.find(
    (step) => step.id === ECheckAndUpdateStepId.FirmwareCheck,
  );

  return (
    isCheckAndUpdateStepAccepted(genuineStep?.state) &&
    isCheckAndUpdateStepAccepted(firmwareStep?.state)
  );
}

export function isCheckAndUpdateRetryDisabled(steps: ICheckAndUpdateStep[]) {
  return steps.some(
    (step) => step.state === ECheckAndUpdateStepState.InProgress,
  );
}

export function keepPostUpdateGenuineRecheckArmed(
  wasArmed: boolean,
  genuineStepState: ECheckAndUpdateStepState | undefined,
) {
  return wasArmed || genuineStepState === ECheckAndUpdateStepState.Error;
}

export function armPostUpdateRecheck<T extends ICheckAndUpdateStep>(
  steps: T[],
) {
  return steps.map((step) => {
    if (
      step.id === ECheckAndUpdateStepId.GenuineCheck &&
      step.state === ECheckAndUpdateStepState.Error
    ) {
      return {
        ...step,
        state: ECheckAndUpdateStepState.Idle,
        errorMessage: undefined,
      };
    }

    return step;
  });
}

export function beginPostUpdateRecheck<T extends ICheckAndUpdateStep>(
  steps: T[],
) {
  return armPostUpdateRecheck(steps).map((step) => {
    if (step.id === ECheckAndUpdateStepId.FirmwareCheck) {
      return {
        ...step,
        state: ECheckAndUpdateStepState.InProgress,
        errorMessage: undefined,
      };
    }

    return step;
  });
}
