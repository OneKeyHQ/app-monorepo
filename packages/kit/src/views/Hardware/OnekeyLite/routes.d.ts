export enum OnekeyLiteModalRoutes {
  OnekeyLitePinCodeVerifyModal = 'OnekeyLitePinCodeVerifyModal',
  OnekeyLiteRestoreModal = 'OnekeyLiteRestoreModal',
  OnekeyLiteBackupModal = 'OnekeyLiteBackupModal',
  OnekeyLiteChangePinModal = 'OnekeyLiteChangePinModal',
  OnekeyLiteResetModal = 'OnekeyLiteResetModal',
}

export type OnekeyLiteRoutesParams = {
  [OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal]: {
    callBack: (pwd: string) => boolean;
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

export enum OnekeyLitePinModalRoutes {
  OnekeyLitePinCodeChangePinModal = 'OnekeyLitePinCodeChangeModal',
  OnekeyLitePinCodeSetModal = 'OnekeyLitePinCodeSetModal',
  OnekeyLitePinCodeRepeatModal = 'OnekeyLitePinCodeRepeatModal',
}

export type OnekeyLitePinRoutesParams = {
  [OnekeyLitePinModalRoutes.OnekeyLitePinCodeChangePinModal]: undefined;
  [OnekeyLitePinModalRoutes.OnekeyLitePinCodeSetModal]: {
    currentPin: string;
  };
  [OnekeyLitePinModalRoutes.OnekeyLitePinCodeRepeatModal]: {
    currentPin: string;
    newPin: string;
  };
};
