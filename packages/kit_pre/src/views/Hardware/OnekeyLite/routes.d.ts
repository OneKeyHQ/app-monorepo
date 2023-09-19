export const enum OnekeyLiteModalRoutes {
  OnekeyLiteChangePinInputPinModal = 'OnekeyLiteChangePinInputPinModal',
  OnekeyLiteChangePinSetModal = 'OnekeyLiteChangePinSetModal',
  OnekeyLiteChangePinRepeatModal = 'OnekeyLiteChangePinRepeatModal',
  OnekeyLiteChangePinModal = 'OnekeyLiteChangePinModal',
  OnekeyLiteRestorePinCodeVerifyModal = 'OnekeyLiteRestorePinCodeVerifyModal',
  OnekeyLiteRestoreModal = 'OnekeyLiteRestoreModal',
  OnekeyLiteRestoreDoneModal = 'OnekeyLiteRestoreDoneModal',
  OnekeyLiteBackupPinCodeVerifyModal = 'OnekeyLiteBackupPinCodeVerifyModal',
  OnekeyLiteBackupModal = 'OnekeyLiteBackupModal',
  OnekeyLiteResetModal = 'OnekeyLiteResetModal',
}

export type OnekeyLiteRoutesParams = {
  [OnekeyLiteModalRoutes.OnekeyLiteChangePinInputPinModal]: undefined;
  [OnekeyLiteModalRoutes.OnekeyLiteChangePinSetModal]: {
    currentPin: string;
  };
  [OnekeyLiteModalRoutes.OnekeyLiteChangePinRepeatModal]: {
    currentPin: string;
    newPin: string;
  };
  [OnekeyLiteModalRoutes.OnekeyLiteChangePinModal]: {
    oldPin: string;
    newPin: string;
  };
  [OnekeyLiteModalRoutes.OnekeyLiteRestorePinCodeVerifyModal]: undefined;
  [OnekeyLiteModalRoutes.OnekeyLiteRestoreModal]: {
    pinCode: string;
  };
  [OnekeyLiteModalRoutes.OnekeyLiteRestoreDoneModal]: {
    mnemonic: string;
    onSuccess: () => void;
  };
  [OnekeyLiteModalRoutes.OnekeyLiteBackupPinCodeVerifyModal]: {
    walletId: string | null;
    backupData: string;
    onSuccess: () => void;
  };
  [OnekeyLiteModalRoutes.OnekeyLiteBackupModal]: {
    walletId: string | null;
    pinCode: string;
    backupData: string;
    onSuccess: () => void;
  };
  [OnekeyLiteModalRoutes.OnekeyLiteResetModal]: undefined;
};
