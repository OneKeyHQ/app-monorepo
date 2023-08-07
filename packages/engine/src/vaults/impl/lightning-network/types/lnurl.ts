export type LNURLError = {
  status: 'ERROR';
  reason: string;
};

export type LNURLDetails =
  | LNURLChannelServiceResponse
  | LNURLPayServiceResponse
  | LNURLAuthServiceResponse
  | LNURLWithdrawServiceResponse;

export interface LNURLPayServiceResponse {
  callback: string; // The URL from LN SERVICE which will accept the pay request parameters
  maxSendable: number; // Max amount LN SERVICE is willing to receive
  minSendable: number; // Min amount LN SERVICE is willing to receive, can not be less than 1 or more than `maxSendable`
  domain: string;
  metadata: string; // Metadata json which must be presented as raw string here, this is required to pass signature verification at a later step
  tag: 'payRequest'; // Type of LNURL
  payerData?: {
    name: { mandatory: boolean };
    pubkey: { mandatory: boolean };
    identifier: { mandatory: boolean };
    email: { mandatory: boolean };
    auth: { mandatory: boolean; k1: string };
  };
  commentAllowed?: number;
  url: string;
}

export interface LNURLAuthServiceResponse {
  tag: 'login'; // Type of LNURL
  k1: string; // (hex encoded 32 bytes of challenge) which is going to be signed by user's linkingPrivKey.
  action?: string; // optional action enum which can be one of four strings: register | login | link | auth.
  domain: string;
  url: string;
}

export interface LNURLWithdrawServiceResponse {
  tag: 'withdrawRequest'; // type of LNURL
  callback: string; // The URL which LN SERVICE would accept a withdrawal Lightning invoice as query parameter
  k1: string; // Random or non-random string to identify the user's LN WALLET when using the callback URL
  defaultDescription: string; // A default withdrawal invoice description
  balanceCheck?: string;
  payLink?: string;
  minWithdrawable: number; // Min amount (in millisatoshis) the user can withdraw from LN SERVICE, or 0
  maxWithdrawable: number; // Max amount (in millisatoshis) the user can withdraw from LN SERVICE, or equal to minWithdrawable if the user has no choice over the amounts
  domain: string;
  url: string;
}

export interface LNURLChannelServiceResponse {
  uri: string; // Remote node address of form node_key@ip_address:port_number
  callback: string; // a second-level URL which would initiate an OpenChannel message from target LN node
  k1: string; // random or non-random string to identify the user's LN WALLET when using the callback URL
  tag: 'channelRequest'; // type of LNURL
  domain: string;
  url: string;
}

export interface LNURLPaymentInfo {
  pr: string;
  successAction?: LNURLPaymentSuccessAction;
}

export interface LNURLPaymentSuccessAction {
  tag: string;
  description?: string;
  message?: string;
  url?: string;
  // for withdrawer result
  amount?: string;
  domain?: string;
}

export type LnurlAuthResponse = {
  success: boolean;
  status: string;
  reason?: string;
  authResponseData: unknown;
};
