export enum EPasswordResStatus {
  CLOSE_STATUS = 'close',
  PASS_STATUS = 'pass',
}
export interface IPasswordRes {
  status: EPasswordResStatus;
  password: string;
}

export enum EPasswordPromptType {
  PASSWORD_SETUP = 'setup',
  PASSWORD_VERIFY = 'verify',
}
