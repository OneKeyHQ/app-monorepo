export enum EModalSignAndVerifyRoutes {
  SignAndVerifyMessage = 'SignAndVerifyMessage',
}

// route.params must stay JSON-serializable & shallow. React Navigation
// deep-equals params on every navigation tick (see useLinking) and any
// nested object with a non-callable toString (e.g. Object.create(null))
// crashes fast-deep-equal. The screen re-derives derive info via
// useActiveAccount on mount, so only primitive identifiers belong here.
export type IModalSignAndVerifyParamList = {
  [EModalSignAndVerifyRoutes.SignAndVerifyMessage]: {
    networkId: string;
    accountId: string | undefined;
    walletId: string | undefined;
    indexedAccountId: string | undefined;
    isOthersWallet: boolean | undefined;
  };
};
