import type { IDepositTask } from './state';

export function getWrappedTaskInterruption(
  task: IDepositTask | undefined,
): 'submitted' | 'unknown' | undefined {
  if (
    task?.steps.some(
      (step) => step.kind === 'deposit' && step.status.type === 'handedOff',
    )
  ) {
    return undefined;
  }
  const wrap = task?.steps.find((step) => step.kind === 'wrap');
  switch (wrap?.status.type) {
    case 'succeeded':
      return 'submitted';
    case 'sending':
    case 'confirming':
    case 'verifying':
    case 'unknown':
      return 'unknown';
    default:
      return undefined;
  }
}
