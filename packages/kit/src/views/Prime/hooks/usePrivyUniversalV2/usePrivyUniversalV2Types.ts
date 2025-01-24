export type IUsePrivyUniversalV2 = {
  logout: () => Promise<void>;
  isReady: boolean;
  getAccessToken: () => Promise<string | null>;
  useLoginWithEmail: (props?: {
    onComplete?: () => void;
    onError?: (error: any) => void;
  }) => {
    sendCode: (args: { email: string }) => Promise<void>;
    loginWithCode: (args: { code: string; email?: string }) => Promise<void>;
  };
  authenticated: boolean;
  user?: {
    id: string;
  };
};
