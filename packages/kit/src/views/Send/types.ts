export enum SendRoutes {
  Send = 'Send',
  SendConfirm = 'SendConfirm',
  SendEditFee = 'SendEditFee',
}

export type SendRoutesParams = {
  [SendRoutes.Send]: undefined;
  [SendRoutes.SendConfirm]: undefined;
  [SendRoutes.SendEditFee]: undefined;
};
