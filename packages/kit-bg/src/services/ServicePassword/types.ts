export enum EPasswordResStatus {
  CLOSE_STATUS = 'close',
  PASS_STATUS = 'pass',
}

export interface IPasswordResData {
  password: string;
}
export interface IPasswordRes {
  status: EPasswordResStatus;
  data: IPasswordResData;
}
