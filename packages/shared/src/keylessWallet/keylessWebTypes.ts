import type { EOAuthSocialLoginProvider } from '../consts/authConsts';
import type { IOnboardingAutoConnectOrigin } from '../routes/onboardingv2';

export { KEYLESS_WEB_TAB_URL_PATTERNS } from './keylessWebTabUrlPatternsConstants';

export const KEYLESS_PENDING_LOGIN_STORAGE_KEY =
  'ONEKEY_KEYLESS_PENDING_LOGIN_V1';

export const KEYLESS_PENDING_LOGIN_EXPIRE_MS = 1000 * 60 * 5;

export enum EKeylessWebFlowStep {
  Idle = 'Idle',
  InstallPrompt = 'InstallPrompt',
  LoginLoading = 'LoginLoading',
  AuthSelect = 'AuthSelect',
  PinSetup = 'PinSetup',
  WalletCreating = 'WalletCreating',
  AccountSelect = 'AccountSelect',
  MismatchPrompt = 'MismatchPrompt',
  Connected = 'Connected',
}

export type IKeylessPendingLoginStatus =
  | 'pending'
  | 'bridgeReady'
  | 'loginSuccess'
  | 'loginFailed'
  | 'consumed';

export type IKeylessPendingLogin = {
  provider: EOAuthSocialLoginProvider;
  nonce: string;
  createdAt: number;
  expireAt: number;
  status: IKeylessPendingLoginStatus;
};

export type IKeylessWebSessionState = {
  pluginInstalled: boolean;
  walletExists: boolean;
  walletType?: EOAuthSocialLoginProvider;
  siteConnected: boolean;
  connectedAccountId?: string;
  pendingProvider?: EOAuthSocialLoginProvider;
  pendingNonce?: string;
};

export enum EKeylessWebPrivateRpcMethod {
  GetStatus = 'wallet_keylessGetStatus',
  OpenSidePanel = 'wallet_keylessOpenSidePanel',
  StartLogin = 'wallet_keylessStartLogin',
  ConfirmPin = 'wallet_keylessConfirmPin',
  SelectAccount = 'wallet_keylessSelectAccount',
  DisconnectSite = 'wallet_keylessDisconnectSite',
}

export enum EKeylessWebBridgeEvent {
  BridgeReady = 'ONEKEY_KEYLESS_BRIDGE_READY',
  LoginDone = 'ONEKEY_KEYLESS_LOGIN_DONE',
  LoginFailed = 'ONEKEY_KEYLESS_LOGIN_FAILED',
}

export const KEYLESS_WEB_CONNECT_ALERT_MESSAGE_TYPE =
  'ONEKEY_KEYLESS_WEB_CONNECT_ALERT';

export const KEYLESS_WEB_OPEN_SIDE_PANEL_EVENT =
  'ONEKEY_KEYLESS_OPEN_SIDE_PANEL_EVENT';

export const KEYLESS_WEB_OPEN_SIDE_PANEL_MESSAGE_TYPE =
  'ONEKEY_KEYLESS_OPEN_SIDE_PANEL_MESSAGE';

export type IKeylessWebConnectAlertMessage = {
  type: typeof KEYLESS_WEB_CONNECT_ALERT_MESSAGE_TYPE;
  message: string;
  timestamp: number;
  provider?: EOAuthSocialLoginProvider;
  nonce?: string;
};

export type IKeylessWebOpenSidePanelPayload = {
  provider?: EOAuthSocialLoginProvider;
  nonce?: string;
};

export type IKeylessWebOpenSidePanelMessage = {
  type: typeof KEYLESS_WEB_OPEN_SIDE_PANEL_MESSAGE_TYPE;
  payload?: IKeylessWebOpenSidePanelPayload;
};

export const KEYLESS_WEB_HASH_KEYS = {
  origin: 'connect_origin',
  provider: 'connect_keyless_provider',
  status: 'connect_status',
  nonce: 'nonce',
  at: 'connect_at',
  error: 'connect_error',
};

export const KEYLESS_WEB_PENDING_TAB_STORAGE_KEY =
  '$$_OneKey_Ext_Keyless_Web_Pending_Tab_$$';

export type IAutoConnectParams = {
  nonce: string;
  autoConnectOrigin: IOnboardingAutoConnectOrigin;
  autoLoginKeylessProvider?: EOAuthSocialLoginProvider;
};

export type IStoredPendingWebTab = {
  tabId: number;
  autoConnectParams: IAutoConnectParams;
  fromInitialInstall?: boolean;
};

export type IKeylessWebBridgeEventPayload = {
  type: EKeylessWebBridgeEvent;
  nonce: string;
  provider?: EOAuthSocialLoginProvider;
  accountId?: string;
  accountAddress?: string;
  error?: string;
  timestamp: number;
};
