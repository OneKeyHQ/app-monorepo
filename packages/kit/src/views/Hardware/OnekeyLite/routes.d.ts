export enum OnekeyLiteModalRoutes {
  OnekeyLitePinCodeVerifyModal = 'OnekeyLitePinCodeVerifyModal',
  OnekeyLitePinCodeCurrentModal = 'OnekeyLitePinCodeCurrentModal',
  OnekeyLitePinCodeSetModal = 'OnekeyLitePinCodeSetModal',
  OnekeyLitePinCodeRepeatModal = 'OnekeyLitePinCodeRepeatModal',
  OnekeyLitePinCodeChangePinModal = 'OnekeyLitePinCodeChangeModal',
  OnekeyLiteRestoreModal = 'OnekeyLiteRestoreModal',
  OnekeyLiteBackupModal = 'OnekeyLiteBackupModal',
  OnekeyLiteChangePinModal = 'OnekeyLiteChangePinModal',
  OnekeyLiteResetModal = 'OnekeyLiteResetModal',
}

export type OnekeyLiteRoutesParams = {
  [OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal]: {
    callBack: (pwd: string) => boolean;
  };
  [OnekeyLiteModalRoutes.OnekeyLitePinCodeSetModal]: {
    callBack: (pwd: string) => boolean;
  };
  [OnekeyLiteModalRoutes.OnekeyLitePinCodeRepeatModal]: {
    callBack: (pwd: string) => boolean;
  };
  [OnekeyLiteModalRoutes.OnekeyLitePinCodeCurrentModal]: {
    callBack: (pwd: string) => boolean;
  };
  [OnekeyLiteModalRoutes.OnekeyLitePinCodeChangePinModal]: {
    callBack: (oldPwd: string, newPwd: string) => boolean;
  };
  [OnekeyLiteModalRoutes.OnekeyLiteRestoreModal]: {
    pwd: string;
    onRetry: () => void;
  };
  [OnekeyLiteModalRoutes.OnekeyLiteBackupModal]: {
    pwd: string;
    onRetry: () => void;
  };
  [OnekeyLiteModalRoutes.OnekeyLiteChangePinModal]: {
    oldPin: string;
    newPin: string;
    onRetry: () => void;
  };
  [OnekeyLiteModalRoutes.OnekeyLiteResetModal]: undefined;
};
