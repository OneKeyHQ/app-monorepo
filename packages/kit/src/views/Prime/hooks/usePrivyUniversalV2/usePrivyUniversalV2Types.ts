export type IPrivyState =
  | { status: 'initial' }
  | {
      status: 'error';
      error: Error | null;
    }
  | { status: 'sending-code' }
  | { status: 'awaiting-code-input' }
  | { status: 'submitting-code' }
  | { status: 'done' };

export interface IUsePrivyUniversalV2 {
  logout: () => Promise<void>;
  isReady: boolean;
  getAccessToken: () => Promise<string | null>;
  useLoginWithEmail: (props?: {
    onComplete?: () => void;
    onError?: (error: any) => void;
  }) => {
    state: IPrivyState;
    sendCode: (args: { email: string }) => Promise<void>;
    loginWithCode: (args: { code: string; email?: string }) => Promise<void>;
  };
  authenticated: boolean;
  privyUser?: {
    id: string;
    email: string;
  };
}
