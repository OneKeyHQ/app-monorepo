/* cspell:ignore Infini */
export type IPrimeSubscriptionInfo = {
  isActive: boolean;
  expiresAt: number;
  subscriptions?: {
    id?: string;
    managementUrl?: string;
    // Payment channel owning this subscription as declared by the server,
    // e.g. 'infini' for the crypto channel; used to route the in-app
    // manage-subscription entry without an extra lookup
    channel?: string;
  }[];
  willRenew?: boolean;
};
export type IPrimeUserInfo = {
  isLoggedIn: boolean; // local supabase sdk login status
  isLoggedInOnServer: boolean; // server api login status
  isEnablePrime: boolean | undefined;
  isEnableSandboxPay: boolean | undefined;
  isPrimeDeviceLimitExceeded: boolean | undefined;
  email: string | undefined; // update by server api (normalizedEmail)
  displayEmail: string | undefined; // update by server api
  nickname: string | undefined; // update by server api
  avatar: string | undefined; // update by server api
  onekeyUserId: string | undefined;
  onekeyAccount: IOneKeyIdAccount | undefined;
  subscriptionManageUrl: string | undefined; // update by local revenuecat sdk: Purchases.getCustomerInfo()
  primeSubscription: IPrimeSubscriptionInfo | undefined;
};

export enum EPrimeAuthSessionSource {
  LegacyEmailSupabase = 'legacy_email_supabase',
  KeylessOAuth = 'keyless_oauth',
}

export enum EOneKeyIdOAuthFlowStatus {
  Success = 'success',
}

export enum EOneKeyIdAccountStatus {
  Active = 'active',
  Merged = 'merged',
}

export enum EOneKeyIdIdentityType {
  LegacyEmail = 'legacy_email',
  OAuth = 'oauth',
}

export enum EOneKeyIdOAuthProvider {
  Google = 'google',
  Apple = 'apple',
}

export enum EOneKeyIdOAuthEmailType {
  Real = 'real',
  ApplePrivateRelay = 'apple_private_relay',
  MissingOrUnverified = 'missing_or_unverified',
}

export enum EOneKeyIdOAuthBindingStatus {
  Bound = 'bound',
}

export enum EOneKeyIdOAuthBindReason {
  ExistingOAuthBinding = 'existing_oauth_binding',
  LegacyEmailAutoBind = 'legacy_email_auto_bind',
  EmailClaimAutoBind = 'email_claim_auto_bind',
  LegacySessionAuthorizedBind = 'legacy_session_authorized_bind',
  NewOAuthAccountCreated = 'new_oauth_account_created',
  // oxlint-disable-next-line @cspell/spellchecker
  MergedSourceRetarget = 'merged_source_retarget',
}

export type IOneKeyIdIdentity = {
  identityType: EOneKeyIdIdentityType;
  oauthIdentityId?: string;
  oauthProvider?: EOneKeyIdOAuthProvider;
  oauthSubject?: string;
  oauthEmailType?: EOneKeyIdOAuthEmailType;
  oauthEmail?: string;
  legacyEmail?: string;
  normalizedEmail?: string;
  displayEmail?: string;
  oauthRelayDomainMatched?: string;
};

export type IOneKeyIdAccount = {
  onekeyUserId: string;
  status: EOneKeyIdAccountStatus;
  normalizedEmail?: string;
  displayEmail?: string;
  identities: IOneKeyIdIdentity[];
};

export type IOneKeyIdOAuthBindingResult = {
  bindingStatus: EOneKeyIdOAuthBindingStatus;
  boundOneKeyUserId: string;
  bindReason: EOneKeyIdOAuthBindReason;
};

export type IOneKeyIdOAuthLoginPrimeUserInfo = {
  avatar?: string;
  nickname?: string;
  isEnablePrime?: boolean;
  isEnableSandboxPay?: boolean;
  isPrime?: boolean;
  isPrimeDeviceLimitExceeded?: boolean;
  primeExpiredAt?: number;
  level?: 'PRIME' | 'NORMAL';
  userId?: string;
  emails?: string[];
  subscriptions?: IPrimeSubscriptionInfo['subscriptions'];
  willRenew?: boolean;
  inviteCode?: string;
  customInviteCode?: string;
  kytEnabled?: boolean;
};

export type IOneKeyIdOAuthLoginResponse = IOneKeyIdOAuthLoginPrimeUserInfo & {
  status: EOneKeyIdOAuthFlowStatus;
  onekeyAccount: IOneKeyIdAccount;
  oauthIdentity: IOneKeyIdIdentity;
  oauthIdentityBinding: IOneKeyIdOAuthBindingResult;
};

export type IOneKeyIdProfileResponse = Partial<IPrimeServerUserInfo> & {
  onekeyAccount: IOneKeyIdAccount;
};

export type IOneKeyIdOAuthBindResponse = {
  status: EOneKeyIdOAuthFlowStatus;
  onekeyAccount: IOneKeyIdAccount;
  oauthIdentity: IOneKeyIdIdentity;
  oauthIdentityBinding: IOneKeyIdOAuthBindingResult;
};

// Billing period of an Infini crypto subscription.
// NOTE: backend schema pending confirmation — the yearly value may end up as
// 'annual' on the server side; keep in sync with POST /prime/v1/infini/checkout.
export type IPrimeInfiniSubscriptionPlan = 'monthly' | 'yearly';

export type IPrimeInfiniPaymentOption = {
  chain: string;
  networkId: string;
  tokens: Array<{
    symbol: string;
    contract: string;
  }>;
};

export type IPrimeInfiniPayment = {
  paymentId: string;
  address: string;
  chain: string;
  token: string;
  amountDue: string;
  expiresAt: number;
  status?: string;
  infiniStatus?: string;
  amountConfirmed?: string;
  amountConfirming?: string;
};

export type IPrimeInfiniPaymentCreateParams = {
  plan: IPrimeInfiniSubscriptionPlan;
  chain: string;
  token: string;
  expectedOneKeyUserId: string;
};

export type IPrimeInfiniPaymentAsset = {
  key: string;
  chain: string;
  token: string;
  networkId: string;
  contractAddress: string;
};

export type IPrimeInfiniBeforeBroadcastAction = {
  type: 'primeInfiniPayment';
  paymentCacheKey: IPrimeInfiniPaymentCacheKey;
};

export type IPrimeInfiniPaymentCacheIdentity = Pick<
  IPrimeInfiniPaymentCacheKey,
  'paymentId' | 'networkId' | 'contractAddress'
>;

export type IPrimeInfiniPaymentCacheKey = {
  bindingId: string;
  paymentId: string;
  networkId: string;
  contractAddress: string;
  onekeyUserId: string;
  plan: IPrimeInfiniSubscriptionPlan;
  payerAccountId: string;
  payerAddress: string;
};

export type IPrimeInfiniPaymentTransferClaim = {
  networkId: string;
  accountId: string;
  accountAddress: string;
  fromAddress: string;
  toAddress: string;
  contractAddress: string;
  amount: string;
};

/**
 * Durable hand-off state for an Infini invoice created by the in-app wallet
 * flow. It is keyed by OneKey ID in SimpleDB so a main-runtime restart cannot
 * silently forget an invoice that may already have been submitted.
 */
export type IPrimeInfiniPendingPaymentSession = {
  schemaVersion: 2;
  asset: IPrimeInfiniPaymentAsset;
  baseline: {
    onekeyUserId: string;
    wasPrimeActive: boolean;
    primeExpiresAt?: number;
    infiniPeriodEnd?: number;
  };
  plan: IPrimeInfiniSubscriptionPlan;
  selectedSubscriptionPeriod: 'P1Y' | 'P1M';
  featureName?: string;
  payerAccountId: string;
  payerAddress: string;
  paymentCacheKey: IPrimeInfiniPaymentCacheKey;
  payment: IPrimeInfiniPayment;
  // Durable no-replacement latch. It becomes true after either the local
  // broadcast claim or any server-observed payment progress.
  sendStarted: boolean;
  updatedAt: number;
};

export type IPrimeInfiniPendingPaymentSessionInput = Omit<
  IPrimeInfiniPendingPaymentSession,
  'schemaVersion' | 'updatedAt'
>;

// Infini crypto subscription detail returned by
// GET /prime/v1/infini/subscription.
// NOTE: backend schema pending confirmation — fields below are proposed from
// the Infini `subscription.update` webhook payload (status / plan_name /
// current_period_start / current_period_end / next_invoice_at /
// subscription_id) and may change once the server contract is finalized.
export type IPrimeInfiniSubscription = {
  subscriptionId: string;
  status: string;
  plan: IPrimeInfiniSubscriptionPlan;
  planName?: string;
  // Price of the current plan, fixed USD amount string (e.g. "29.99")
  amount?: string;
  // Timestamps in milliseconds, aligned with primeExpiredAt
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  nextInvoiceAt?: number;
  // Infini has no auto-charge: willRenew means "renewal invoices keep being
  // generated", not "will be charged automatically"
  willRenew?: boolean;
  // Payment url of the latest renewal invoice, passed through by the server
  // when available (see integration plan §7.2)
  latestInvoiceUrl?: string;
};

export type IPrimeInfiniPurchaseStatusSnapshot = {
  onekeyUserId: string;
  primeSubscription: IPrimeSubscriptionInfo | undefined;
  infiniSubscription: IPrimeInfiniSubscription | undefined;
};

export type IPrimeInfiniPaymentPreBroadcastSnapshot = {
  payment: IPrimeInfiniPayment;
  purchaseStatusSnapshot: IPrimeInfiniPurchaseStatusSnapshot;
};

export type IPrimeDeviceInfo = {
  instanceId: string;
  lastLoginTime: string;
  platform: string;
  platformName: string | undefined;
  version: string;
  deviceName: string;
};

export type IPrimeServerUserInfo = {
  avatar: string | undefined; // update by server api
  nickname: string | undefined; // update by server api
  createdAt: string;
  updatedAt: string;

  isEnablePrime: boolean | undefined;
  isEnableSandboxPay: boolean | undefined;
  isPrime: boolean;
  isPrimeDeviceLimitExceeded: boolean | undefined;
  primeExpiredAt: number;
  level: 'PRIME' | 'NORMAL';
  salt: string;
  pwdHash: string;
  userId: string;
  displayEmail?: string;
  emails: string[];
  subscriptions?: {
    id?: string;
    managementUrl?: string;
    // Payment channel owning this subscription (e.g. 'infini'), see
    // IPrimeSubscriptionInfo.subscriptions
    channel?: string;
  }[];
  willRenew?: boolean;
  // isLogin

  inviteCode: string;

  // Whether the user has enabled KYT (receive risk monitoring) on the server.
  // Used as the source of truth for the KYT switch and the intro dialog gate.
  kytEnabled?: boolean;
};

export enum ESecurityPasswordType {
  CloudSyncR1 = 'CloudSyncR1', // risk level 1 (low), for wallet names, bookmarks, etc.
  CloudSyncR5 = 'CloudSyncR5', // risk level 5 (high), for wallet private keys, mnemonic words, etc.
}

export type IShopifyOrderLineItem = {
  title: string;
  quantity: number;
  imageUrl: string;
};

export type IShopifyOrder = {
  orderNumber: string;
  status: string;
  itemCount: number;
  createdAt: string;
  totalPrice: string;
  currencyCode: string;
  lineItems: IShopifyOrderLineItem[];
};
