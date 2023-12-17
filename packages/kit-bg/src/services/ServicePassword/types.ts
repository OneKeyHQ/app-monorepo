export enum EPasswordResStatus {
  CLOSE_STATUS = 'close',
  PASS_STATUS = 'pass',
}
export interface IPasswordRes {
  status: EPasswordResStatus;
  password: string;
}
