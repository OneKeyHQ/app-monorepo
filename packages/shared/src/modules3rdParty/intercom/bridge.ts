export const INTERCOM_SUPPORT_ORIGIN = 'https://intercom.onekey.so';
export const INTERCOM_CONTEXT_METHOD = 'wallet_getIntercomContext';

export type IIntercomSupportContext = {
  intercom_user_jwt?: string;
};

export const createIntercomBridgeReplyScript = (payload: string) => `
  if (window.location.origin === ${JSON.stringify(INTERCOM_SUPPORT_ORIGIN)}) {
    if (window.$onekey && window.$onekey.jsBridge) {
      window.$onekey.jsBridge.receive(${JSON.stringify(payload)});
    }
  }
  void 0;
`;
