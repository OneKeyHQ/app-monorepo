import type { ITrezorDeviceAuthenticityProof } from './thirdPartyDeviceAuthenticity';

export type IThirdPartyDeviceRewardVendor = 'trezor' | 'ledger';

interface IThirdPartyDeviceRewardChallengeBase {
  challengeId: string;
  expiresAt: number;
}

export type IThirdPartyDeviceRewardChallenge =
  | (IThirdPartyDeviceRewardChallengeBase & {
      vendor: 'trezor';
      challengeHex: string;
    })
  | (IThirdPartyDeviceRewardChallengeBase & {
      vendor: 'ledger';
      ledgerRelay: {
        webSocketUrl: string;
      };
    });

export type IThirdPartyDeviceRewardTrezorProof = ITrezorDeviceAuthenticityProof;

export interface IThirdPartyDeviceRewardVoucher {
  campaignId: string;
  code: string;
  status: 'unused' | 'used' | 'expired' | 'revoked';
  issuedAt: number;
  expiresAt: number;
  usedAt?: number;
}

export type IThirdPartyDeviceRewardClaimResult =
  | {
      status: 'issued' | 'already_claimed';
      claimId: string;
      voucher: IThirdPartyDeviceRewardVoucher;
    }
  | {
      status:
        | 'challenge_expired'
        | 'challenge_consumed'
        | 'device_proof_invalid'
        | 'device_not_genuine'
        | 'ledger_session_incomplete'
        | 'not_eligible'
        | 'campaign_unavailable';
      claimId?: never;
      voucher?: never;
    };

export type IThirdPartyDeviceRewardClaimSuccess = Extract<
  IThirdPartyDeviceRewardClaimResult,
  { status: 'issued' | 'already_claimed' }
>;
