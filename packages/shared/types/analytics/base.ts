export interface IBaseEventPayload {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
}
