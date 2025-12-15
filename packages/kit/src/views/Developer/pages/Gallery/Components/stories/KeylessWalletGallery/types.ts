export type IStepStatus = 'pending' | 'loading' | 'success' | 'error';

export interface IStepState {
  status: IStepStatus;
  error?: string;
  result?: unknown;
}
