// Reset 相关
export enum OnekeyLiteResetModalRoutes {
  OnekeyLiteResetModal = 'OnekeyLiteResetModal',
}

export type OnekeyLiteResetRoutesParams = {
  [OnekeyLiteResetModalRoutes.OnekeyLiteResetModal]: undefined;
};

// Change Pin 相关
export enum OnekeyLiteChangePinModalRoutes {
  OnekeyLiteChangePinInputPinModal = 'OnekeyLiteChangePinInputPinModal',
  OnekeyLiteChangePinSetModal = 'OnekeyLiteChangePinSetModal',
  OnekeyLiteChangePinRepeatModal = 'OnekeyLiteChangePinRepeatModal',
  OnekeyLiteChangePinModal = 'OnekeyLiteChangePinModal',
}

export type OnekeyLiteChangePinRoutesParams = {
  [OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinInputPinModal]: undefined;
  [OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinSetModal]: {
    currentPin: string;
  };
  [OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinRepeatModal]: {
    currentPin: string;
    newPin: string;
  };
  [OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinModal]: {
    oldPin: string;
    newPin: string;
    onRetry: () => void;
  };
};
