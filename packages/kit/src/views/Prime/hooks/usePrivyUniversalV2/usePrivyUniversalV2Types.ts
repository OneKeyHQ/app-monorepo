type IState =
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
    state: IState;
    sendCode: (args: { email: string }) => Promise<void>;
    loginWithCode: (args: { code: string; email?: string }) => Promise<void>;
  };
  authenticated: boolean;
  user?: {
    id: string;
  };
}
