export enum OnekeyLiteModalRoutes {
  OnekeyLitePinCodeVerifyModal = 'OnekeyLitePinCodeVerifyModal',
  OnekeyLitePinCodeCurrentModal = 'OnekeyLitePinCodeCurrentModal',
  OnekeyLitePinCodeSetModal = 'OnekeyLitePinCodeSetModal',
  OnekeyLitePinCodeRepeatModal = 'OnekeyLitePinCodeRepeatModal',
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
  [OnekeyLiteModalRoutes.OnekeyLiteRestoreModal]: undefined;
  [OnekeyLiteModalRoutes.OnekeyLiteBackupModal]: undefined;
  [OnekeyLiteModalRoutes.OnekeyLiteChangePinModal]: undefined;
  [OnekeyLiteModalRoutes.OnekeyLiteResetModal]: undefined;
};
