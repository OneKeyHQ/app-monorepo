import platformEnv from '../platformEnv';

// Privy
export const PRIVY_APP_ID = 'cm6c9xup40017zyrnnp8zh0bt';
export const PRIVY_MOBILE_CLIENT_ID =
  'client-WY5gESiXQgTXogYv2M8iCM3LaaDDaKAdigE9Bg7a9pr1W';

// Revenuecat
export const REVENUECAT_API_KEY_STRIPE = 'strp_AEqUtFOZYaIjPSuQGBVHVrqyiUs';
export const REVENUECAT_API_KEY_APPLE = 'appl_RTHLoohMIGQHXWTBflulzJEjKah';
export const REVENUECAT_API_KEY_GOOGLE = 'goog_gxczxfDKTJRlkAHpZhVgPtIwSsg';
export const REVENUECAT_API_KEY_WEB = 'rcb_OQDYrGcbnrzaKUaIDRhXQxEqBNTB';
export const REVENUECAT_API_KEY_WEB_SANDBOX =
  'rcb_sb_gxqFGxelBplIYJuYPhcnRhjfA';

export enum EPrimeCloudSyncDataType {
  Lock = 'Lock', // cloud only for password verification
  Wallet = 'Wallet',
  IndexedAccount = 'IndexedAccount',
  Account = 'Account',
  BrowserBookmark = 'BrowserBookmark',
  AddressBook = 'AddressBook',
  MarketWatchList = 'MarketWatchList',
  CustomToken = 'CustomToken',
  CustomNetwork = 'CustomNetwork',
  CustomRpc = 'CustomRpc',
}

export enum EPrimeEmailOTPScene {
  UpdateRebateWithdrawAddress = 'UpdateReabteWithdrawAddress',
  DeleteOneKeyId = 'DeleteAccount',
}

export const PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME = 144_000_000; // '1970/01/03'
export const RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID =
  '180B50C8-E4EC-40E9-9CF3-7DD71F2882F7';

// export const ALWAYS_VERIFY_PASSCODE_WHEN_CHANGE_SET_MASTER_PASSWORD = true;
export const ALWAYS_VERIFY_PASSCODE_WHEN_CHANGE_SET_MASTER_PASSWORD =
  !platformEnv.isDev;

export const ENCRYPTED_SECURITY_PASSWORD_SPLITTER = '@';
// local security password r1
export const ENCRYPTED_SECURITY_PASSWORD_R1_PREFIX = `L_SP_R1${ENCRYPTED_SECURITY_PASSWORD_SPLITTER}`;
// server security password r1
export const ENCRYPTED_SECURITY_PASSWORD_R1_FOR_SERVER_PREFIX = `S_SP_R1${ENCRYPTED_SECURITY_PASSWORD_SPLITTER}`;
