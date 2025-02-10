import type { LoginUIConfig } from '@privy-io/expo';
import type { PrivyUser } from '@privy-io/public-api';
import type { LoginModalOptions, User } from '@privy-io/react-auth';

export type IUsePrivyUniversal = {
  native:
    | {
        error: Error | null | undefined;
        user: PrivyUser | null | undefined;
        login: ((config: LoginUIConfig) => void) | undefined;
      }
    | undefined;
  web:
    | {
        user: User | null | undefined;
        login:
          | ((options?: LoginModalOptions | React.MouseEvent<any, any>) => void)
          | undefined;
        updateEmail: (() => void) | undefined; // web only
        updatePhone: (() => void) | undefined; // web only
      }
    | undefined;
  userEmail: string | undefined;
  privyUserId: string | undefined;
  authenticated: boolean;
  isReady: boolean;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};
